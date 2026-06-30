const SERVER = "http://localhost:5000";

const LISTING_PATTERNS = [
  /domain\.com\.au\/[\w-]+-\d{5,}/,
  /realestate\.com\.au\/property-[\w+\-]+-\d{5,}/,
];

function isListingUrl(url) {
  return LISTING_PATTERNS.some((p) => p.test(url));
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "") + u.pathname.substring(0, 45);
  } catch {
    return url.substring(0, 50);
  }
}

function setStatus(el, state, text) {
  el.className = "tab-status " + state;
  el.textContent = text;
}

async function scrapeTab(tab, statusEl, profileId) {
  setStatus(statusEl, "loading", "Reading page...");

  // Step 1: inject a script into the tab to grab page content
  let injected;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          // Structured JSON-LD (schema.org)
          const jsonLd = Array.from(
            document.querySelectorAll('script[type="application/ld+json"]'),
          )
            .map((s) => {
              try {
                return JSON.parse(s.textContent);
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          // __NEXT_DATA__ — try by ID first, then scan all application/json scripts
          let nextData = null;
          const nextById = document.getElementById("__NEXT_DATA__");
          if (nextById) {
            try { nextData = JSON.parse(nextById.textContent); } catch {}
          }
          if (!nextData) {
            for (const s of document.querySelectorAll('script[type="application/json"]')) {
              try {
                const parsed = JSON.parse(s.textContent);
                // Accept any JSON object that looks like page/listing data
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  nextData = parsed;
                  break;
                }
              } catch {}
            }
          }
          // Fallback: grab inline script content that contains lat/lng or address data
          let rawScriptData = "";
          if (!nextData) {
            for (const s of document.querySelectorAll("script:not([src])")) {
              const t = s.textContent || "";
              if ((t.includes('"latitude"') || t.includes('"lat"')) && t.includes('"longitude"') && t.length < 500000) {
                rawScriptData += t.substring(0, 100000);
                break;
              }
            }
          }

          // Meta tags — title/description/OG often contain full address on listing sites
          const pageTitle = document.title || "";
          const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
          const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
          const ogDesc = document.querySelector('meta[property="og:description"]')?.content || "";

          // Images: OG image + all large listing photos
          const images = [];
          const og = document.querySelector('meta[property="og:image"]');
          if (og && og.content) images.push(og.content);
          document.querySelectorAll("img").forEach((img) => {
            const src = img.src || img.dataset.src || img.dataset.lazy;
            if (
              src &&
              !src.startsWith("data:") &&
              (img.naturalWidth > 300 ||
                img.width > 300 ||
                img.getAttribute("width") > 300) &&
              !images.includes(src)
            ) {
              images.push(src);
            }
          });

          // Visible text from main content area
          const mainEl =
            document.querySelector("main") ||
            document.querySelector('[class*="property-info"]') ||
            document.querySelector('[class*="listing-details"]') ||
            document.querySelector('[class*="property-details"]') ||
            document.body;

          const visibleText = (mainEl.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 20000);

          return {
            ok: true,
            jsonLd,
            nextData,
            rawScriptData,
            pageTitle,
            metaDesc,
            ogTitle,
            ogDesc,
            images: images.slice(0, 20),
            visibleText,
            url: location.href,
          };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
    });

    if (!results || !results[0]) {
      setStatus(
        statusEl,
        "error",
        "Script injection failed — try reloading the tab",
      );
      return;
    }

    injected = results[0].result;
  } catch (e) {
    setStatus(
      statusEl,
      "error",
      "Cannot read page: " + (e.message || "permission denied"),
    );
    return;
  }

  if (!injected || !injected.ok) {
    setStatus(
      statusEl,
      "error",
      "Page read error: " + (injected?.error || "unknown"),
    );
    return;
  }

  const { jsonLd, nextData, rawScriptData, pageTitle, metaDesc, ogTitle, ogDesc, images: pageImages, visibleText, url } = injected;

  if (!visibleText || visibleText.length < 50) {
    setStatus(
      statusEl,
      "error",
      "Page appears empty — try refreshing the listing",
    );
    return;
  }

  // Send JSON-LD first (parser expects it before the double newline), then visible text.
  // Append __NEXT_DATA__ as extra context if present.
  const structuredPart =
    jsonLd && jsonLd.length ? JSON.stringify(jsonLd) : "[]";
  const metaPart = [pageTitle, ogTitle, metaDesc, ogDesc].filter(Boolean).join("\n");
  const nextPart = nextData
    ? "\n\nNEXT_DATA:" + JSON.stringify(nextData).substring(0, 60000)
    : "";
  const scriptPart = rawScriptData ? "\n\nRAW_SCRIPT:" + rawScriptData.substring(0, 100000) : "";
  const htmlContent = structuredPart + "\n\n" + metaPart + "\n" + visibleText + nextPart + scriptPart;
  const browserImages = pageImages || [];

  // Step 2: send to local server
  setStatus(statusEl, "loading", "Adding to Property Scout...");

  // Step 2: scrape (parse the page content into structured data)
  let scrapeRes, scraped;
  try {
    scrapeRes = await fetch(`${SERVER}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, htmlContent, browserImages, profileId }),
    });
    scraped = await scrapeRes.json();
  } catch (e) {
    setStatus(
      statusEl,
      "error",
      "Cannot reach server — is Property Scout running?",
    );
    return;
  }

  if (!scrapeRes.ok) {
    const msg = (
      scraped?.error || `Server error ${scrapeRes.status}`
    ).substring(0, 100);
    setStatus(statusEl, "error", msg);
    return;
  }

  // Step 3: save to database
  setStatus(statusEl, "loading", "Saving...");
  let saveRes, saved;
  try {
    saveRes = await fetch(`${SERVER}/api/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scraped),
    });
    saved = await saveRes.json();
  } catch (e) {
    setStatus(
      statusEl,
      "error",
      "Parsed OK but failed to save — is Property Scout running?",
    );
    return;
  }

  if (!saveRes.ok) {
    const msg = (saved?.error || `Save error ${saveRes.status}`).substring(0, 100);
    setStatus(statusEl, "error", msg);
    return;
  }

  const label = saved.upserted === "updated" ? "Updated: " : "Added: ";
  setStatus(statusEl, "success", label + (saved.address || scraped.address || "property"));
}

// Persist selected profile across popup opens
const profileSelect = document.getElementById("profile-select");
chrome.storage.local.get("profileId", ({ profileId }) => {
  if (profileId) profileSelect.value = profileId;
});
profileSelect.addEventListener("change", () => {
  chrome.storage.local.set({ profileId: profileSelect.value });
});

document.getElementById("scan-btn").addEventListener("click", async () => {
  const btn = document.getElementById("scan-btn");
  const resultsEl = document.getElementById("results");
  const profileId = profileSelect.value;
  btn.disabled = true;
  btn.textContent = "Scanning...";
  resultsEl.innerHTML = "";

  let allTabs;
  try {
    allTabs = await chrome.tabs.query({});
  } catch (e) {
    resultsEl.innerHTML =
      '<div id="empty">Failed to query tabs: ' + e.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Scan Open Tabs";
    return;
  }

  const listingTabs = allTabs.filter((t) => t.url && isListingUrl(t.url));

  if (listingTabs.length === 0) {
    resultsEl.innerHTML =
      '<div id="empty">No property listing tabs found.<br/>Open some listings on domain.com.au or<br/>realestate.com.au and try again.</div>';
    btn.disabled = false;
    btn.textContent = "Scan Open Tabs";
    return;
  }

  const statusEls = listingTabs.map((tab) => {
    const row = document.createElement("div");
    row.className = "tab-row";
    row.innerHTML = `<div class="tab-url">${shortUrl(tab.url)}</div><div class="tab-status pending">Waiting...</div>`;
    resultsEl.appendChild(row);
    return row.querySelector(".tab-status");
  });

  await Promise.all(listingTabs.map((tab, i) => scrapeTab(tab, statusEls[i], profileId)));

  btn.disabled = false;
  btn.textContent = "Scan Open Tabs";
});

document.getElementById("delete-all-btn").addEventListener("click", () => {
  const btn = document.getElementById("delete-all-btn");
  const resultsEl = document.getElementById("results");

  // Inline confirmation to avoid popup-closes-on-dialog Chrome extension bug
  resultsEl.innerHTML = `
    <div id="empty">
      Delete all properties?<br/>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <button id="confirm-delete" style="padding:6px 14px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Yes, delete all</button>
        <button id="cancel-delete" style="padding:6px 14px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:13px">Cancel</button>
      </div>
    </div>`;

  document.getElementById("cancel-delete").addEventListener("click", () => {
    resultsEl.innerHTML = "";
  });

  document.getElementById("confirm-delete").addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Deleting...";
    resultsEl.innerHTML = "";

    try {
      const res = await fetch(`${SERVER}/api/properties`, { method: "DELETE" });
      if (res.ok) {
        resultsEl.innerHTML = '<div id="empty">All properties deleted.</div>';
      } else {
        resultsEl.innerHTML = '<div id="empty">Delete failed — is Property Scout running?</div>';
      }
    } catch {
      resultsEl.innerHTML = '<div id="empty">Cannot reach server — is Property Scout running?</div>';
    }

    btn.disabled = false;
    btn.textContent = "Delete All";
  });
});
