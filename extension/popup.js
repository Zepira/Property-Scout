const SERVER = "http://localhost:3000";

const LISTING_PATTERNS = [
  /domain\.com\.au\/[\w-]+-\d{5,}/,
  /realestate\.com\.au\/property-[\w-]+-\d{5,}/,
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

async function scrapeTab(tab, statusEl) {
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
            document.querySelectorAll('script[type="application/ld+json"]')
          )
            .map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } })
            .filter(Boolean);

          // __NEXT_DATA__ — domain.com.au / realestate.com.au store full listing here
          let nextData = null;
          const nextScript = document.getElementById("__NEXT_DATA__");
          if (nextScript) {
            try { nextData = JSON.parse(nextScript.textContent); } catch {}
          }

          // Images: OG image + all large listing photos
          const images = [];
          const og = document.querySelector('meta[property="og:image"]');
          if (og && og.content) images.push(og.content);
          document.querySelectorAll("img").forEach((img) => {
            const src = img.src || img.dataset.src || img.dataset.lazy;
            if (
              src &&
              !src.startsWith("data:") &&
              (img.naturalWidth > 300 || img.width > 300 || img.getAttribute("width") > 300) &&
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

          return { ok: true, jsonLd, nextData, images: images.slice(0, 20), visibleText, url: location.href };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
    });

    if (!results || !results[0]) {
      setStatus(statusEl, "error", "Script injection failed — try reloading the tab");
      return;
    }

    injected = results[0].result;
  } catch (e) {
    setStatus(statusEl, "error", "Cannot read page: " + (e.message || "permission denied"));
    return;
  }

  if (!injected || !injected.ok) {
    setStatus(statusEl, "error", "Page read error: " + (injected?.error || "unknown"));
    return;
  }

  const { jsonLd, nextData, images: pageImages, visibleText, url } = injected;

  if (!visibleText || visibleText.length < 50) {
    setStatus(statusEl, "error", "Page appears empty — try refreshing the listing");
    return;
  }

  // Send JSON-LD first (parser expects it before the double newline), then visible text.
  // Append __NEXT_DATA__ as extra context if present.
  const structuredPart = jsonLd && jsonLd.length ? JSON.stringify(jsonLd) : "[]";
  // Send enough of __NEXT_DATA__ to capture gallery + geo (coords are often deep in the JSON)
  const nextPart = nextData ? "\n\nNEXT_DATA:" + JSON.stringify(nextData).substring(0, 60000) : "";
  const htmlContent = structuredPart + "\n\n" + visibleText + nextPart;
  const browserImages = pageImages || [];

  // Step 2: send to local server
  setStatus(statusEl, "loading", "Adding to Property Scout...");

  // Step 2: scrape (parse the page content into structured data)
  let scrapeRes, scraped;
  try {
    scrapeRes = await fetch(`${SERVER}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, htmlContent, browserImages }),
    });
    scraped = await scrapeRes.json();
  } catch (e) {
    setStatus(statusEl, "error", "Cannot reach server — is Property Scout running?");
    return;
  }

  if (!scrapeRes.ok) {
    const msg = (scraped?.error || `Server error ${scrapeRes.status}`).substring(0, 100);
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
    setStatus(statusEl, "error", "Parsed OK but failed to save — is Property Scout running?");
    return;
  }

  if (!saveRes.ok) {
    const msg = (saved?.error || `Save error ${saveRes.status}`).substring(0, 100);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")) {
      setStatus(statusEl, "exists", "Already in your list");
    } else {
      setStatus(statusEl, "error", msg);
    }
    return;
  }

  setStatus(statusEl, "success", "Added: " + (saved.address || scraped.address || "property"));
}

document.getElementById("scan-btn").addEventListener("click", async () => {
  const btn = document.getElementById("scan-btn");
  const resultsEl = document.getElementById("results");
  btn.disabled = true;
  btn.textContent = "Scanning...";
  resultsEl.innerHTML = "";

  let allTabs;
  try {
    allTabs = await chrome.tabs.query({});
  } catch (e) {
    resultsEl.innerHTML = '<div id="empty">Failed to query tabs: ' + e.message + "</div>";
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

  await Promise.all(listingTabs.map((tab, i) => scrapeTab(tab, statusEls[i])));

  btn.disabled = false;
  btn.textContent = "Scan Open Tabs";
});
