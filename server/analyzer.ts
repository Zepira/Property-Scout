export interface ExtractionResult {
  address: string;
  price: number;
  landSize: number; // in acres
  bedrooms: number;
  bathrooms: number;
  carSpaces: number;
  description: string;
  agentName: string;
  agentAgency: string;
  agentPhone: string;
  images: string[];
  lat?: number;
  lng?: number;
  existingHouse: boolean;
  vacantLand: boolean;
  shed: boolean;
  dam: boolean;
  waterTanks: boolean;
  stables: boolean;
  horseFacilities: boolean;
  powerConnected: boolean;
  septic: boolean;
  bushfireMentions: string;
  buildabilityMentions: string;
  planningReferences: string;
  nativeVegetationReferences: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function has(text: string, ...terms: string[]): boolean {
  const t = text.toLowerCase();
  return terms.some((w) => t.includes(w));
}

function extractMentions(text: string, terms: string[]): string {
  const t = text.toLowerCase();
  const hits = terms.filter((w) => t.includes(w.toLowerCase()));
  if (!hits.length) return "none";
  // Return the surrounding sentence for the first hit
  const idx = t.indexOf(hits[0].toLowerCase());
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + 120);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function parsePrice(raw: string | number | undefined): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  const s = raw.toString().toLowerCase().replace(/[,$\s]/g, "");
  if (s.includes("k")) return parseFloat(s) * 1000;
  if (s.includes("m")) return parseFloat(s) * 1_000_000;
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseLandAcres(raw: string | number | undefined): number {
  if (!raw) return 0;
  const s = raw.toString();
  const m = s.match(/([\d.]+)\s*(ha|hectare|acre|ac)/i);
  if (!m) {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(m[1]);
  return m[2].toLowerCase().startsWith("ha") ? parseFloat((n * 2.471).toFixed(2)) : n;
}

// ─── JSON-LD parser (schema.org) ────────────────────────────────────────────

function fromJsonLd(nodes: any[]): Partial<ExtractionResult> | null {
  // Flatten nested @graph arrays
  const all: any[] = [];
  for (const node of nodes) {
    if (Array.isArray(node?.["@graph"])) all.push(...node["@graph"]);
    else all.push(node);
  }

  const listing = all.find(
    (n) =>
      n?.["@type"] &&
      [
        "RealEstateListing",
        "SingleFamilyResidence",
        "House",
        "Residence",
        "Apartment",
        "LandLot",
        "Product",
      ].some((t) => (Array.isArray(n["@type"]) ? n["@type"].includes(t) : n["@type"] === t))
  );
  if (!listing) return null;

  const addr =
    typeof listing.address === "string"
      ? listing.address
      : [
          listing.address?.streetAddress,
          listing.address?.addressLocality,
          listing.address?.addressRegion,
          listing.address?.postalCode,
        ]
          .filter(Boolean)
          .join(", ") || listing.name || "";

  const images: string[] = [];
  if (typeof listing.image === "string") images.push(listing.image);
  else if (Array.isArray(listing.image)) images.push(...listing.image.map((i: any) => (typeof i === "string" ? i : i?.url)).filter(Boolean));

  const price =
    parsePrice(listing.offers?.price) ||
    parsePrice(listing.offers?.priceSpecification?.price) ||
    parsePrice(listing.price);

  const landRaw =
    listing.lotSize?.value ??
    listing.floorSize?.value ??
    listing.landArea?.value ??
    listing.landSize;

  const landUnit =
    listing.lotSize?.unitText ??
    listing.floorSize?.unitText ??
    listing.landArea?.unitText ??
    "";

  let landSize = 0;
  if (landRaw) {
    const n = parseFloat(String(landRaw));
    landSize = landUnit?.toLowerCase().includes("ha")
      ? parseFloat((n * 2.471).toFixed(2))
      : n;
  }

  return {
    address: addr,
    price,
    landSize,
    bedrooms: parseInt(listing.numberOfBedrooms ?? listing.numberOfRooms ?? "0", 10) || 0,
    bathrooms: parseInt(listing.numberOfBathroomsTotal ?? listing.numberOfBathrooms ?? "0", 10) || 0,
    carSpaces: parseInt(listing.numberOfParkingSpaces ?? listing.parkingTotal ?? "0", 10) || 0,
    description: listing.description || "",
    images,
    lat: listing.geo?.latitude ? parseFloat(listing.geo.latitude) : undefined,
    lng: listing.geo?.longitude ? parseFloat(listing.geo.longitude) : undefined,
    agentName:
      (Array.isArray(listing.agent) ? listing.agent[0]?.name : listing.agent?.name) || "",
    agentAgency:
      (Array.isArray(listing.agent)
        ? listing.agent[0]?.worksFor?.name
        : listing.agent?.worksFor?.name) || "",
    agentPhone:
      (Array.isArray(listing.agent)
        ? listing.agent[0]?.telephone
        : listing.agent?.telephone) || "",
  };
}

// ─── visible-text regex parser ──────────────────────────────────────────────

function fromText(text: string): Partial<ExtractionResult> {
  // Address: look for street number + name + suburb + VIC pattern
  const addrMatch = text.match(
    /\d+[A-Za-z]?\s+[\w\s'-]+(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Court|Ct|Lane|Ln|Way|Place|Pl|Highway|Hwy|Crescent|Cres|Parade|Pde|Close|Cl)\s*,?\s*[\w\s]+(?:VIC|NSW|QLD|SA|WA)\s*\d{4}/i
  );
  const address = addrMatch ? addrMatch[0].replace(/\s+/g, " ").trim() : "";

  // Price: $X or $X,XXX or $Xk or $X.Xm, optionally a range (take lower)
  const priceMatch = text.match(/\$\s*([\d,\.]+\s*(?:k|m(?:illion)?)?)/i);
  const price = priceMatch ? parsePrice(priceMatch[1]) : 0;

  // Land size: X acres / X ha / X hectares
  const landMatch = text.match(/([\d.]+)\s*(acres?|ac\b|ha\b|hectares?)/i);
  const landSize = landMatch ? parseLandAcres(landMatch[0]) : 0;

  // Room counts
  const bedMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?)/i);
  const bathMatch = text.match(/(\d+)\s*(?:bath(?:room)?s?)/i);
  const carMatch = text.match(/(\d+)\s*(?:car(?:\s*(?:space|garage|park))?s?)/i);

  // Agent phone
  const phoneMatch = text.match(/(?:\+?61|0)[2-9]\d{8,9}/);

  // Description: grab the longest paragraph that looks like listing copy
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 80);
  const description = paras.sort((a, b) => b.length - a.length)[0] || text.slice(0, 500);

  return {
    address,
    price,
    landSize,
    bedrooms: bedMatch ? parseInt(bedMatch[1], 10) : 0,
    bathrooms: bathMatch ? parseInt(bathMatch[1], 10) : 0,
    carSpaces: carMatch ? parseInt(carMatch[1], 10) : 0,
    description,
    agentPhone: phoneMatch ? phoneMatch[0] : "",
  };
}

// ─── keyword feature detection ───────────────────────────────────────────────

function detectFeatures(text: string): Partial<ExtractionResult> {
  const isVacant = has(text, "vacant land", "vacant block", "bare land", "raw land", "undeveloped");
  const hasHouse = has(text, "bedroom", "bathroom", "living room", "kitchen", "home", "house", "dwelling", "residence");

  return {
    existingHouse: hasHouse && !isVacant,
    vacantLand: isVacant,
    shed: has(text, "shed", "barn", "workshop", "machinery shed", "hay shed", "outbuilding"),
    dam: has(text, "dam", "creek", "pond", "waterhole", "billabong", "spring"),
    waterTanks: has(text, "water tank", "rainwater", "tank water", "bore", "well water"),
    stables: has(text, "stable", "loose box", "tack room", "hay loft", "horse shed"),
    horseFacilities: has(text, "horse", "equestrian", "arena", "round yard", "dressage", "paddock", "horse trail", "bridle"),
    powerConnected: has(text, "mains power", "power connected", "electricity connected", "grid power", "power supply"),
    septic: has(text, "septic", "wastewater", "effluent", "sewage"),
    bushfireMentions: extractMentions(text, ["bushfire", "bmo", "fire risk", "fire hazard", "fire management overlay", "ember", "raz", "fire zone"]),
    buildabilityMentions: extractMentions(text, ["building envelope", "build", "construction", "soil test", "easement", "level block", "flat land", "cleared"]),
    planningReferences: extractMentions(text, ["planning permit", "council", "zoning", "green wedge", "gwz", "rcz", "farming zone", "rural zone", "subdivision"]),
    nativeVegetationReferences: extractMentions(text, ["native vegetation", "vpo", "vegetation overlay", "native timber", "clearing permit", "indigenous vegetation", "native trees"]),
  };
}

// ─── __NEXT_DATA__ parser (domain.com.au / realestate.com.au) ────────────────

function extractCoordsFromText(text: string): { lat: number; lng: number } | null {
  const isVic = (lat: number, lng: number) =>
    lat < -33 && lat > -39.5 && lng > 140 && lng < 150;

  const patterns = [
    /center=([-\d.]+),([-\d.]+)/,
    // URL-encoded pipe (%7C) used in domain.com.au static map markers
    /(?:\||%7C)([-\d.]+),([-\d.]+)/,
    /"latitude"\s*:\s*"?([-\d.]+)"?[^}]{0,80}"longitude"\s*:\s*"?([-\d.]+)"?/,
    /"lat"\s*:\s*([-\d.]+)[^}]{0,40}"lng"\s*:\s*([-\d.]+)/,
    /"lat"\s*:\s*([-\d.]+)[^}]{0,40}"lon"\s*:\s*([-\d.]+)/,
    /\\"lat\\":([-\d.]+).*?\\"lng\\":([-\d.]+)/,
  ];

  for (const re of patterns) {
    // Use global search to try every match, not just the first
    const iter = text.matchAll(new RegExp(re.source, "g"));
    for (const m of iter) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isVic(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

function fromNextData(nd: any): Partial<ExtractionResult> {
  if (!nd) return {};
  // domain.com.au structure
  const cp = nd?.props?.pageProps?.componentProps;
  if (!cp) return {};

  const agent = Array.isArray(cp.agents) && cp.agents[0];

  // Images from gallery slides
  const images: string[] = [];
  if (Array.isArray(cp.gallery?.slides)) {
    for (const slide of cp.gallery.slides) {
      const url = slide?.images?.original?.url || slide?.images?.tablet?.url;
      if (url) images.push(url);
    }
  }

  // Geo: try direct fields first, then extract from static map URL
  let lat: number | undefined;
  let lng: number | undefined;

  if (cp.geo?.lat && cp.geo?.lng) {
    lat = parseFloat(cp.geo.lat);
    lng = parseFloat(cp.geo.lng);
  } else if (cp.address?.geoLocation?.latitude) {
    lat = parseFloat(cp.address.geoLocation.latitude);
    lng = parseFloat(cp.address.geoLocation.longitude);
  } else {
    const coords = extractCoordsFromText(JSON.stringify(nd));
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  // Description: join array of paragraphs if present
  let description = "";
  if (Array.isArray(cp.description)) {
    description = cp.description.filter((s: string) => s?.trim()).join("\n\n");
  } else if (typeof cp.description === "string") {
    description = cp.description;
  }

  return {
    address: cp.address || "",
    price: parsePrice(cp.price) || parsePrice(cp.displayPrice),
    bedrooms: parseInt(cp.beds ?? cp.bedrooms ?? "0", 10) || 0,
    bathrooms: parseInt(cp.baths ?? cp.bathrooms ?? "0", 10) || 0,
    carSpaces: parseInt(cp.parking ?? cp.carSpaces ?? "0", 10) || 0,
    description,
    agentName: agent ? agent.name || "" : "",
    agentAgency: cp.agencyName || "",
    agentPhone: agent ? (agent.mobile || agent.phone || "") : "",
    images,
    lat,
    lng,
  };
}

// ─── public API ──────────────────────────────────────────────────────────────

export function extractPropertyFromText(content: string): ExtractionResult {
  // Split out the structured sections the extension sends
  let jsonLdNodes: any[] = [];
  let nextData: any = null;
  let text = content;

  try {
    const jsonEnd = content.indexOf("\n\n");
    if (jsonEnd > 0 && content.trimStart().startsWith("[")) {
      jsonLdNodes = JSON.parse(content.slice(0, jsonEnd));
      text = content.slice(jsonEnd + 2);
    }
  } catch {
    // not JSON up front, treat everything as text
  }

  // Extract and strip the NEXT_DATA block so it doesn't pollute the text parser
  const nextMatch = text.match(/NEXT_DATA:([\s\S]+)$/);
  if (nextMatch) {
    try { nextData = JSON.parse(nextMatch[1]); } catch {}
    text = text.slice(0, text.indexOf("NEXT_DATA:")).trim();
  }

  const fromNd = fromNextData(nextData);
  const fromLd = fromJsonLd(jsonLdNodes) ?? {};
  const fromTxt = fromText(text);
  const features = detectFeatures(text);

  // Geo fallback: scan the full raw content for embedded map coordinates
  let lat = fromNd.lat ?? fromLd.lat;
  let lng = fromNd.lng ?? fromLd.lng;
  if (!lat || !lng) {
    const coords = extractCoordsFromText(content);
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  console.log(`Parsed: address="${fromNd.address || fromLd.address || fromTxt.address}" lat=${lat} lng=${lng} images=${(fromNd.images?.length || fromLd.images?.length || 0)}`);

  // Priority: NEXT_DATA > JSON-LD > regex text
  const merged: ExtractionResult = {
    address: fromNd.address || fromLd.address || fromTxt.address || "",
    price: fromNd.price || fromLd.price || fromTxt.price || 0,
    landSize: fromLd.landSize || fromTxt.landSize || 0,
    bedrooms: fromNd.bedrooms ?? fromLd.bedrooms ?? fromTxt.bedrooms ?? 0,
    bathrooms: fromNd.bathrooms ?? fromLd.bathrooms ?? fromTxt.bathrooms ?? 0,
    carSpaces: fromNd.carSpaces ?? fromLd.carSpaces ?? fromTxt.carSpaces ?? 0,
    description: fromNd.description || fromLd.description || fromTxt.description || "",
    agentName: fromNd.agentName || fromLd.agentName || "",
    agentAgency: fromNd.agentAgency || fromLd.agentAgency || "",
    agentPhone: fromNd.agentPhone || fromLd.agentPhone || fromTxt.agentPhone || "",
    images: fromNd.images?.length ? fromNd.images : (fromLd.images?.length ? fromLd.images : []),
    lat,
    lng,
    ...features,
  };

  return merged;
}

export function extractPropertyFromUrl(url: string, htmlContent?: string): ExtractionResult {
  if (!htmlContent || htmlContent.length < 100) {
    throw new Error(
      "No page content available. Make sure to use the browser extension to import listings — paste the URL into an open tab on domain.com.au or realestate.com.au and use the extension button."
    );
  }

  // Strip HTML tags if raw HTML was passed (server-side fetch fallback)
  const isHtml = htmlContent.trimStart().startsWith("<");
  let text = htmlContent;
  if (isHtml) {
    text = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 20000);
  }

  console.log(`Parsing property from ${text.length} chars of content`);
  return extractPropertyFromText(text);
}
