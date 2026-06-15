import "dotenv/config";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

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

  // AI features
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

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    address: {
      type: Type.STRING,
      description: "Complete physical address of the property in Victoria, Australia.",
    },
    price: {
      type: Type.NUMBER,
      description: "Numeric price of the property. If price guide says 'Contact Agent' or is empty, estimate or return 0. If price range given like $850k - $900k, return the midpoint (e.g. 875000).",
    },
    landSize: {
      type: Type.NUMBER,
      description: "The total land size converted to ACRES (numeric only, e.g. 5.5). IMPORTANT: If specified in hectares (ha), convert it to acres! (Multiply hectares by 2.471 to get acres. E.g. 2ha = 4.94 acres). Avoid returning 0, extract the actual block size.",
    },
    bedrooms: {
      type: Type.INTEGER,
      description: "Number of bedrooms. If vacant land, output 0.",
    },
    bathrooms: {
      type: Type.INTEGER,
      description: "Number of bathrooms. If vacant land, output 0.",
    },
    carSpaces: {
      type: Type.INTEGER,
      description: "Number of car parking spaces. Output 0 if none.",
    },
    description: {
      type: Type.STRING,
      description: "Comprehensive listing description or summary if very long.",
    },
    agentName: {
      type: Type.STRING,
      description: "Contact name of the listing agent.",
    },
    agentAgency: {
      type: Type.STRING,
      description: "Real estate agency name.",
    },
    agentPhone: {
      type: Type.STRING,
      description: "Agent's telephone or mobile number.",
    },
    images: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Any image URLs linked in the listing. If none discoverable, return an empty array.",
    },
    lat: {
      type: Type.NUMBER,
      description: "Estimated or extracted latitude coordinate.",
    },
    lng: {
      type: Type.NUMBER,
      description: "Estimated or extracted longitude coordinate.",
    },
    existingHouse: {
      type: Type.BOOLEAN,
      description: "Is there an existing liveable house or home on the property? False if vacant land.",
    },
    vacantLand: {
      type: Type.BOOLEAN,
      description: "Is this property primarily a vacant piece of land without any residential home? True if vacant, False if a house exists.",
    },
    shed: {
      type: Type.BOOLEAN,
      description: "True if any shed, barn, outbuilding, or workshop is mentioned.",
    },
    dam: {
      type: Type.BOOLEAN,
      description: "True if a catchment dam, natural water hole, creek, or pond is on the property.",
    },
    waterTanks: {
      type: Type.BOOLEAN,
      description: "True if rain water tanks, water bore, or domestic water storage are mentioned.",
    },
    stables: {
      type: Type.BOOLEAN,
      description: "True if horse stables, animal shelters, or equine complexes are explicitly mentioned.",
    },
    horseFacilities: {
      type: Type.BOOLEAN,
      description: "True if acreage features like round yard, dressage arena, horse paddocks, horse fencing, or day yards are mentioned.",
    },
    powerConnected: {
      type: Type.BOOLEAN,
      description: "True if power is connected to the property, or mains power lines are available.",
    },
    septic: {
      type: Type.BOOLEAN,
      description: "True if a septic tank system, wastewater, or sewer system is explicitly mentioned.",
    },
    bushfireMentions: {
      type: Type.STRING,
      description: "Any mentions of bushfire overlays (e.g. BMO - Bushfire Management Overlay), fire risk, clearing requirements, or 'none' if there are no mentions.",
    },
    buildabilityMentions: {
      type: Type.STRING,
      description: "Any mentions of building envelope, soil conditions, level ground, easement, or buildability. Write 'none' if none.",
    },
    planningReferences: {
      type: Type.STRING,
      description: "Any references to council permits, planning permits, zoning (e.g. Green Wedge Zone - GWZ, Rural Conservation Zone - RCZ, Farming Zone), plans or approved paperwork. Write 'none' if none.",
    },
    nativeVegetationReferences: {
      type: Type.STRING,
      description: "Any mentions of native flora protection, vegetation overlays (e.g. VPO), dense trees, timber, or restrictions on clearing bushes/trees. Write 'none' if none.",
    },
  },
  required: [
    "address",
    "price",
    "landSize",
    "bedrooms",
    "bathrooms",
    "carSpaces",
    "description",
    "agentName",
    "agentAgency",
    "existingHouse",
    "vacantLand",
    "shed",
    "dam",
    "waterTanks",
    "stables",
    "horseFacilities",
    "powerConnected",
    "septic",
    "bushfireMentions",
    "buildabilityMentions",
    "planningReferences",
    "nativeVegetationReferences",
  ],
};

function generateAcreageFallbackProperty(url: string): ExtractionResult {
  let pathStr = "";
  try {
    const parsedUrl = new URL(url);
    pathStr = parsedUrl.pathname + parsedUrl.search;
  } catch {
    pathStr = url;
  }

  const words = pathStr
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && w !== "https" && w !== "www" && w !== "com" && w !== "property" && w !== "house" && w !== "vic" && w !== "realestate" && w !== "domain");

  const standardTowns = [
    "emerald", "pakenham", "gembrook", "monbulk", "belgrave", "kyneton", "woodend", "gisborne", "yarrambat", "warrandyte",
    "moorabbin", "cranbourne", "berwick", "beaconsfield", "narre warren", "cardinia", "longwarry", "bunyip", "drouin"
  ];

  let detectedTown = "Emerald";
  for (const town of standardTowns) {
    if (words.includes(town)) {
      detectedTown = town.charAt(0).toUpperCase() + town.slice(1);
      break;
    }
  }

  let streetName = "Scenic Ridge Road";
  if (words.includes("cardinia")) streetName = "Cardinia Road";
  else if (words.includes("monbulk")) streetName = "Emerald-Monbulk Road";
  else if (words.includes("main")) streetName = "Main Street";
  else if (words.includes("station")) streetName = "Station Street";

  const randomNum = Math.floor(Math.random() * 200) + 1;
  const address = `${randomNum} ${streetName}, ${detectedTown} VIC`;

  const hasStables = url.toLowerCase().includes("horse") || url.toLowerCase().includes("stable") || Math.random() > 0.4;
  const isVacant = url.toLowerCase().includes("vacant") || url.toLowerCase().includes("land") || Math.random() > 0.7;
  const landSizeNum = Math.random() > 0.5 ? Math.floor(Math.random() * 15) + 3 : Math.floor(Math.random() * 8) + 2;

  return {
    address,
    price: Math.random() > 0.5 ? 890000 : 720000,
    landSize: parseFloat(landSizeNum.toFixed(1)),
    bedrooms: isVacant ? 0 : 4,
    bathrooms: isVacant ? 0 : 2,
    carSpaces: isVacant ? 0 : 3,
    description: `[SIMULATED FALLBACK DUE TO API 429] A beautiful acreage property situated at ${address}. Features spectacular scenery, clean air, rich pasture land, perimeter fencing, existing water tanks, and ready utility connections. Excellent residential lifestyle or equestrian options.`,
    agentName: "Sarah Jenkins (Simulated)",
    agentAgency: "Acreage Specialists Victoria",
    agentPhone: "+61 412 345 678",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop"
    ],
    lat: -37.8 + (Math.random() - 0.5) * 0.4,
    lng: 145.4 + (Math.random() - 0.5) * 0.4,
    existingHouse: !isVacant,
    vacantLand: isVacant,
    shed: true,
    dam: Math.random() > 0.5,
    waterTanks: true,
    stables: hasStables,
    horseFacilities: hasStables,
    powerConnected: Math.random() > 0.3,
    septic: !isVacant,
    bushfireMentions: "Falls under standard Bushfire Management Overlay (BMO). Safety boundaries apply.",
    buildabilityMentions: "Favorable dry building zones identified with minor grading required.",
    planningReferences: "Zoned Green Wedge Zone (GWZ) which protects rural activity and supports local farm use.",
    nativeVegetationReferences: "Features scattered native eucalyptus trees. Perimeter boundaries are beautiful and fully cleared."
  };
}

function generateAcreageFallbackFromText(text: string): ExtractionResult {
  const addressMatch = text.match(/(?:at|address:?\s*)([0-9]+\s+[A-Za-z0-9\s,\-]+,\s*(?:Emerald|Pakenham|Moorabbin|Gembrook|Kyneton|Emerald|Melbourne|VIC)[A-Za-z0-9\s,\-]*)/i);
  const address = addressMatch ? addressMatch[1].trim() : "120 Scenic Crescent, Emerald VIC 3782";

  const priceMatch = text.match(/(?:\$|price:?\s*)([0-9]+(?:\s*[kK]|\s*[mM]illion|\s*,[0-9]{3})*)/);
  let price = 750000;
  if (priceMatch) {
    const rawPrice = priceMatch[1].toLowerCase();
    if (rawPrice.includes("k")) {
      price = parseFloat(rawPrice.replace("k", "")) * 1000;
    } else if (rawPrice.includes("m")) {
      price = parseFloat(rawPrice.replace("m", "")) * 1000000;
    } else {
      price = parseInt(rawPrice.replace(/[^0-9]/g, "")) || 750000;
    }
  }

  const landSizeMatch = text.match(/([0-9\.]+)\s*(?:acre|ac|ha|hectare)/i);
  let landSize = 5.0;
  if (landSizeMatch) {
    landSize = parseFloat(landSizeMatch[1]) || 5.0;
    if (landSizeMatch[0].toLowerCase().includes("ha") || landSizeMatch[0].toLowerCase().includes("hectare")) {
      landSize = parseFloat((landSize * 2.471).toFixed(1));
    }
  }

  const isVacant = text.toLowerCase().includes("vacant") || text.toLowerCase().includes("bare land");

  return {
    address,
    price,
    landSize,
    bedrooms: isVacant ? 0 : 4,
    bathrooms: isVacant ? 0 : 2,
    carSpaces: isVacant ? 0 : 2,
    description: `[SIMULATED FALLBACK DUE TO API 429] Local text parsing used due to API quota limits. Listing summary: ${text.substring(0, 150)}...`,
    agentName: "Local Parser",
    agentAgency: "Acreage Specialists Victoria",
    agentPhone: "+61 412 345 678",
    images: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop"],
    lat: -37.8546,
    lng: 145.4371,
    existingHouse: !isVacant,
    vacantLand: isVacant,
    shed: text.includes("shed") || text.includes("workshop"),
    dam: text.includes("dam") || text.includes("creek"),
    waterTanks: text.includes("tank") || text.includes("water"),
    stables: text.includes("stable") || text.includes("equestrian"),
    horseFacilities: text.includes("horse") || text.includes("arena") || text.includes("stable"),
    powerConnected: text.includes("power") || text.includes("mains"),
    septic: text.includes("septic"),
    bushfireMentions: text.includes("bushfire") || text.includes("bmo") ? "Mentions bushfire risk or vegetation clearing concerns." : "none",
    buildabilityMentions: text.includes("build") || text.includes("envelope") ? "Mentions building details or envelope limits." : "none",
    planningReferences: text.includes("planning") || text.includes("permit") || text.includes("zone") ? "Planning references found in description." : "none",
    nativeVegetationReferences: text.includes("native") || text.includes("tree") || text.includes("timber") ? "Protected native timber / vegetation references found." : "none"
  };
}

export async function extractPropertyFromText(descriptionText: string): Promise<ExtractionResult> {
  const prompt = `
Analyze this property listing description for a rural/acreage property in Victoria, Australia.
Extract all requested details and format them into the required JSON schema.

Listing text:
"""
${descriptionText}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        systemInstruction: "You are an expert real estate data extraction assistant. You parse complex real estate descriptions into precise JSON structured attributes.",
      },
    });

    const parsed = JSON.parse(response.text!) as ExtractionResult;
    return parsed;
  } catch (error: any) {
    const errorString = String(error?.message || error || "");
    console.error("Gemini text extraction failed with error:", error);

    if (errorString.includes("429") || errorString.includes("quota") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("rate-limits") || errorString.includes("limit")) {
      throw new Error(
        "Google Gemini API Quota Limit Exceeded (Rate Limited / Code 429). " +
        "The shared API key has temporarily reached its rate limit. " +
        "You can wait a brief moment before retrying, or configure your own 'GEMINI_API_KEY' in the Workspace Secrets/Settings panel."
      );
    }

    throw new Error(`AI Analysis failed: ${errorString || "Unknown API communication issue."}`);
  }
}

export async function extractPropertyFromUrl(url: string, htmlContent?: string): Promise<ExtractionResult> {
  // If we have HTML content, we can clean it or pass it.
  // Otherwise, we use Google Search grounding inside Gemini to look up the listing contents!
  if (htmlContent && htmlContent.length > 200) {
    const cleanedText = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 15000); // Grab a large sample of text

    return extractPropertyFromText(cleanedText);
  }

  console.log(`Step 1: Querying Gemini with Google Search tool to research property URL: ${url}`);
  const searchPrompt = `
Search and find detailed real estate listing details for the Victorian property at this URL: ${url}
Please retrieve the property address, price guide, total land size (in acres or hectares), bedrooms, bathrooms, car spaces, agent details, and specific features (such as existing house, vacant land, stables, shed, paddock, arena, power, septic connection, water tanks, bushfire overlay mentions, planning references, zoning, native timber/vegetation clearing rules).
Provide all discovery results in detailed plain text description paragraphs.
`;

  try {
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are an expert real estate researcher using Google Search to discover detailed acreage listing attributes, plans, description, and agent data for Australian properties.",
      },
    });

    const retrievedText = searchResponse.text || "";
    console.log("Step 2: Parsing retrieved text into high-quality structured property JSON...");

    // Send the plain text synopsis into extractPropertyFromText to convert to 100% compliant JSON
    const parsed = await extractPropertyFromText(
      `Retrieved listing details for URL: ${url}\n\n` + retrievedText
    );

    return parsed;
  } catch (error: any) {
    const errorString = String(error?.message || error || "");
    console.error("Gemini URL search-grounding extraction failed with error:", error);

    if (errorString.includes("429") || errorString.includes("quota") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("rate-limits") || errorString.includes("limit")) {
      throw new Error(
        "Google Gemini API Quota Limit Exceeded (Rate Limited / Code 429). " +
        "The shared API key has temporarily reached its rate limit. " +
        "You can wait a brief moment before retrying, or configure your own 'GEMINI_API_KEY' in the Workspace Secrets/Settings panel."
      );
    }

    throw new Error(`AI Scraper failed: ${errorString || "Unknown API communication issue."}`);
  }
}
