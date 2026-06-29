import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getDb } from "./server/db.js";
import { extractPropertyFromUrl, extractPropertyFromText } from "./server/analyzer.js";
import type { ProfileId } from './src/types.js';
import { calculateScores, calculateFHBScores, geocodeAddress, fetchCommuteTimes, PROFILE_CONFIG } from "./server/scoring.js";

async function startServer() {
  const app = express();
  const PORT = 5000;

  app.use(express.json({ limit: "25mb" }));

  // Allow Chrome extension and local dev to call the API
  app.use((req, res, next) => {
    const origin = req.headers.origin || "";
    if (origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Initialize SQLite database
  const db = await getDb();

  // API ROUTE: Get all profiles
  app.get('/api/profiles', async (_req, res) => {
    try {
      const profiles = await db.all(`SELECT id, name FROM profiles ORDER BY id`);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Get all properties
  app.get("/api/properties", async (req, res) => {
    try {
      const profileId: ProfileId = (req.query.profile as ProfileId) || 'farm';
      if (profileId !== 'farm' && profileId !== 'firsthome') {
        return res.status(400).json({ error: 'Invalid profile' });
      }
      const properties = await db.all(
        `SELECT * FROM properties WHERE profile_id = ? ORDER BY id DESC`,
        [profileId]
      );
      const parsed = properties.map((p) => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        existingHouse: p.existingHouse === 1,
        vacantLand: p.vacantLand === 1,
        shed: p.shed === 1,
        dam: p.dam === 1,
        waterTanks: p.waterTanks === 1,
        stables: p.stables === 1,
        horseFacilities: p.horseFacilities === 1,
        powerConnected: p.powerConnected === 1,
        septic: p.septic === 1,
        isNewBuild: p.isNewBuild === 1,
      }));
      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Get single property
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await db.get("SELECT * FROM properties WHERE id = ?", [req.params.id]);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json({
        ...property,
        images: JSON.parse(property.images || "[]"),
        existingHouse: property.existingHouse === 1,
        vacantLand: property.vacantLand === 1,
        shed: property.shed === 1,
        dam: property.dam === 1,
        waterTanks: property.waterTanks === 1,
        stables: property.stables === 1,
        horseFacilities: property.horseFacilities === 1,
        powerConnected: property.powerConnected === 1,
        septic: property.septic === 1,
        isNewBuild: property.isNewBuild === 1,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Scrape property listing URL or manual processing
  app.post("/api/scrape", async (req, res) => {
    const { url, htmlContent, browserImages, descriptionText, address, price, landSize, bedrooms, bathrooms, carSpaces } = req.body;

    try {
      const profileId: ProfileId = req.body.profileId || 'farm';
      const garages = Number(req.body.garages) || 0;
      const landSqm = Number(req.body.landSqm) || 0;
      const isNewBuild = Boolean(req.body.isNewBuild);

      let extracted: any;

      if (url && (url.includes("domain.com.au") || url.includes("realestate.com.au") || url.startsWith("http"))) {
        let pageHtml = htmlContent || "";

        if (!pageHtml) {
          console.log(`Fetching page HTML for: ${url}`);
          try {
            const pageRes = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.9",
              },
            });
            if (pageRes.ok) {
              pageHtml = await pageRes.text();
              console.log(`Fetched ${pageHtml.length} chars of HTML`);
            } else {
              console.warn(`Page fetch returned ${pageRes.status}, will try with empty content`);
            }
          } catch (fetchErr) {
            console.warn(`Page fetch failed (${fetchErr}), extension content required`);
          }
        } else {
          console.log(`Using browser-provided HTML (${pageHtml.length} chars) for: ${url}`);
        }

        console.log(`Parsing property data for: ${url}`);
        extracted = await extractPropertyFromUrl(url, pageHtml);
      } else if (descriptionText) {
        // Run AI Extraction on listing text
        console.log(`Extracting from manually pasted listing description...`);
        extracted = await extractPropertyFromText(descriptionText);
      } else if (address) {
        // Fully manual creation
        extracted = {
          address,
          price: Number(price) || 0,
          landSize: Number(landSize) || 0,
          bedrooms: Number(bedrooms) || 0,
          bathrooms: Number(bathrooms) || 0,
          carSpaces: Number(carSpaces) || 0,
          description: descriptionText || "Manually detailed property.",
          agentName: "Manual Entry",
          agentAgency: "Property Scout",
          agentPhone: "",
          images: [],
          existingHouse: true,
          vacantLand: false,
          shed: false,
          dam: false,
          waterTanks: false,
          stables: false,
          horseFacilities: false,
          powerConnected: true,
          septic: true,
          bushfireMentions: "None",
          buildabilityMentions: "None",
          planningReferences: "None",
          nativeVegetationReferences: "None",
        };
      } else {
        return res.status(400).json({ error: "Provide a Listing URL, Listing text, or Address" });
      }

      // Check if coordinate is available or fetch it from Google Geocoding API if present
      const mapKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || "AIzaSyBRCXm3cMSGUX4GhtK-VbP0RfNfMqQeQ8o";
      let lat = extracted.lat;
      let lng = extracted.lng;

      if ((!lat || !lng) && extracted.address) {
        const coords = await geocodeAddress(extracted.address, mapKey);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        } else {
          console.warn(`No coordinates for "${extracted.address}" — geocoding failed, using suburb lookup`);
          const addr = extracted.address.toLowerCase();
          const suburbCoords: [string[], number, number][] = [
            [["gembrook", "tonimbuk"], -37.9528, 145.5581],
            [["hoddles creek", "launching place"], -37.7833, 145.5500],
            [["emerald", "olinda", "sassafras", "monbulk", "belgrave"], -37.8546, 145.4371],
            [["modella", "garfield", "bunyip", "longwarry", "nar nar goon"], -38.0500, 145.6200],
            [["pakenham", "beaconsfield", "officer", "cardinia"], -38.0712, 145.4856],
            [["koo wee rup", "lang lang", "tynong"], -38.1950, 145.5500],
            [["warrandyte", "yarrambat", "wonga park"], -37.7500, 145.2300],
            [["moorabbin", "bentleigh", "cheltenham"], -37.9473, 145.0646],
          ];
          let found = false;
          for (const [keywords, defLat, defLng] of suburbCoords) {
            if (keywords.some(k => addr.includes(k))) {
              lat = defLat; lng = defLng; found = true; break;
            }
          }
          if (!found) { lat = -38.0163; lng = 145.2148; }
        }
      }

      // Let's query Driving/Traffic commute times using Maps API if Key exists
      const dest = PROFILE_CONFIG[profileId];
      let commuteTimeAM = 0;
      let commuteTimePM = 0;
      if (lat && lng && mapKey) {
        const commute = await fetchCommuteTimes(lat, lng, mapKey, dest.lat, dest.lng);
        if (commute) {
          commuteTimeAM = commute.timeAM;
          commuteTimePM = commute.timePM;
        }
      }

      // Calculate Scores — profile-aware
      let scores: any;
      if (profileId === 'firsthome') {
        scores = calculateFHBScores(
          {
            price: extracted.price || 0,
            bedrooms: extracted.bedrooms || 0,
            bathrooms: extracted.bathrooms || 0,
            garages,
            landSqm,
          },
          lat && lng ? { lat, lng } : null,
          commuteTimeAM,
          commuteTimePM,
        );
      } else {
        const propertyFeatures = {
          landSize: extracted.landSize || 0,
          price: extracted.price || 0,
          existingHouse: extracted.existingHouse,
          vacantLand: extracted.vacantLand,
          shed: extracted.shed,
          dam: extracted.dam,
          waterTanks: extracted.waterTanks,
          stables: extracted.stables,
          horseFacilities: extracted.horseFacilities,
          powerConnected: extracted.powerConnected,
          septic: extracted.septic,
        };
        scores = calculateScores(propertyFeatures, lat && lng ? { lat, lng } : null, dest.lat, dest.lng);
        if (commuteTimeAM > 0 && commuteTimePM > 0) {
          scores.commuteTimeAM = commuteTimeAM;
          scores.commuteTimePM = commuteTimePM;
          // Re-score based on accurate maps times
          const avg = (commuteTimeAM + commuteTimePM) / 2;
          let cs = 0;
          if (avg <= 40) cs = 100;
          else if (avg <= 60) cs = 75;
          else if (avg <= 75) cs = 50;
          else if (avg <= 90) cs = 25;
          scores.commuteScore = cs;
          scores.overallScore = Math.round(
            cs * 0.35 +
            scores.landScore * 0.25 +
            scores.budgetScore * 0.20 +
            scores.horseScore * 0.10 +
            scores.buildabilityScore * 0.10
          );
        }
        scores.houseSizeScore = 0;
      }

      // Merge images: prefer parsed images, fill with browser-captured ones
      const mergedImages: string[] = extracted.images && extracted.images.length
        ? extracted.images
        : (browserImages || []);

      const cleanResult = {
        ...extracted,
        lat,
        lng,
        images: mergedImages,
        ...scores,
        profileId,
        garages,
        landSqm,
        isNewBuild,
        status: "New",
        notes: "",
        url: url || "",
      };

      res.json(cleanResult);
    } catch (error: any) {
      console.error("Scraping error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Save or update property (upsert by URL)
  app.post("/api/properties", async (req, res) => {
    const p = req.body;

    // Strip query params and fragments so re-visiting a URL with tracking params still matches
    const normalizeUrl = (u: string) => {
      try { const parsed = new URL(u); return parsed.origin + parsed.pathname; } catch { return u; }
    };
    const canonicalUrl = normalizeUrl(p.url || "");

    const profileId: ProfileId = p.profileId || 'farm';
    const garages = Number(p.garages) || 0;
    const landSqm = Number(p.landSqm) || 0;
    const isNewBuild = p.isNewBuild ? 1 : 0;
    const houseSizeScore = Number(p.houseSizeScore) || 0;

    const fieldValues = [
      canonicalUrl,
      p.address,
      Number(p.price) || 0,
      Number(p.landSize) || 0,
      Number(p.bedrooms) || 0,
      Number(p.bathrooms) || 0,
      Number(p.carSpaces) || 0,
      garages,
      landSqm,
      isNewBuild,
      p.description || "",
      p.agentName || "",
      p.agentAgency || "",
      p.agentPhone || "",
      JSON.stringify(p.images || []),
      Number(p.lat) || null,
      Number(p.lng) || null,
      p.existingHouse ? 1 : 0,
      p.vacantLand ? 1 : 0,
      p.shed ? 1 : 0,
      p.dam ? 1 : 0,
      p.waterTanks ? 1 : 0,
      p.stables ? 1 : 0,
      p.horseFacilities ? 1 : 0,
      p.powerConnected ? 1 : 0,
      p.septic ? 1 : 0,
      p.bushfireMentions || "",
      p.buildabilityMentions || "",
      p.planningReferences || "",
      p.nativeVegetationReferences || "",
      Number(p.commuteScore) || 0,
      Number(p.commuteTimeAM) || 0,
      Number(p.commuteTimePM) || 0,
      Number(p.landScore) || 0,
      Number(p.budgetScore) || 0,
      Number(p.horseScore) || 0,
      Number(p.buildabilityScore) || 0,
      houseSizeScore,
      Number(p.overallScore) || 0,
      profileId,
    ];

    const mapBooleans = (row: any) => ({
      ...row,
      images: JSON.parse(row.images || "[]"),
      existingHouse: row.existingHouse === 1,
      vacantLand: row.vacantLand === 1,
      shed: row.shed === 1,
      dam: row.dam === 1,
      waterTanks: row.waterTanks === 1,
      stables: row.stables === 1,
      horseFacilities: row.horseFacilities === 1,
      powerConnected: row.powerConnected === 1,
      septic: row.septic === 1,
      isNewBuild: row.isNewBuild === 1,
    });

    try {
      const existing = canonicalUrl ? await db.get("SELECT * FROM properties WHERE url = ?", [canonicalUrl]) : null;

      if (existing) {
        // Update all listing data but preserve user's notes and status
        await db.run(
          `UPDATE properties SET
            url = ?, address = ?, price = ?, landSize = ?, bedrooms = ?, bathrooms = ?, carSpaces = ?,
            garages = ?, landSqm = ?, isNewBuild = ?,
            description = ?, agentName = ?, agentAgency = ?, agentPhone = ?, images = ?, lat = ?, lng = ?,
            existingHouse = ?, vacantLand = ?, shed = ?, dam = ?, waterTanks = ?, stables = ?, horseFacilities = ?, powerConnected = ?, septic = ?,
            bushfireMentions = ?, buildabilityMentions = ?, planningReferences = ?, nativeVegetationReferences = ?,
            commuteScore = ?, commuteTimeAM = ?, commuteTimePM = ?, landScore = ?, budgetScore = ?, horseScore = ?, buildabilityScore = ?, houseSizeScore = ?, overallScore = ?,
            profile_id = ?,
            status = ?, notes = ?
          WHERE id = ?`,
          [...fieldValues, existing.status || "New", existing.notes || "", existing.id]
        );
        const updated = await db.get("SELECT * FROM properties WHERE id = ?", [existing.id]);
        res.json({ ...mapBooleans(updated), upserted: "updated" });
      } else {
        const result = await db.run(
          `INSERT INTO properties (
            url, address, price, landSize, bedrooms, bathrooms, carSpaces,
            garages, landSqm, isNewBuild,
            description, agentName, agentAgency, agentPhone, images, lat, lng,
            existingHouse, vacantLand, shed, dam, waterTanks, stables, horseFacilities, powerConnected, septic,
            bushfireMentions, buildabilityMentions, planningReferences, nativeVegetationReferences,
            commuteScore, commuteTimeAM, commuteTimePM, landScore, budgetScore, horseScore, buildabilityScore, houseSizeScore, overallScore,
            profile_id,
            status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [...fieldValues, p.status || "New", p.notes || ""]
        );
        const saved = await db.get("SELECT * FROM properties WHERE id = ?", [result.lastID]);
        res.json({ ...mapBooleans(saved), upserted: "created" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Update existing property (notes, status, or any parameters)
  app.put("/api/properties/:id", async (req, res) => {
    const { id } = req.params;
    const p = req.body;

    try {
      await db.run(
        `UPDATE properties SET
          url = ?, address = ?, price = ?, landSize = ?, bedrooms = ?, bathrooms = ?, carSpaces = ?,
          garages = ?, landSqm = ?, isNewBuild = ?,
          description = ?, agentName = ?, agentAgency = ?, agentPhone = ?, images = ?, lat = ?, lng = ?,
          existingHouse = ?, vacantLand = ?, shed = ?, dam = ?, waterTanks = ?, stables = ?, horseFacilities = ?, powerConnected = ?, septic = ?,
          bushfireMentions = ?, buildabilityMentions = ?, planningReferences = ?, nativeVegetationReferences = ?,
          commuteScore = ?, commuteTimeAM = ?, commuteTimePM = ?, landScore = ?, budgetScore = ?, horseScore = ?, buildabilityScore = ?, houseSizeScore = ?, overallScore = ?,
          profile_id = ?,
          status = ?, notes = ?
        WHERE id = ?`,
        [
          p.url || "",
          p.address,
          Number(p.price) || 0,
          Number(p.landSize) || 0,
          Number(p.bedrooms) || 0,
          Number(p.bathrooms) || 0,
          Number(p.carSpaces) || 0,
          Number(p.garages) || 0,
          Number(p.landSqm) || 0,
          p.isNewBuild ? 1 : 0,
          p.description || "",
          p.agentName || "",
          p.agentAgency || "",
          p.agentPhone || "",
          JSON.stringify(p.images || []),
          Number(p.lat) || null,
          Number(p.lng) || null,
          p.existingHouse ? 1 : 0,
          p.vacantLand ? 1 : 0,
          p.shed ? 1 : 0,
          p.dam ? 1 : 0,
          p.waterTanks ? 1 : 0,
          p.stables ? 1 : 0,
          p.horseFacilities ? 1 : 0,
          p.powerConnected ? 1 : 0,
          p.septic ? 1 : 0,
          p.bushfireMentions || "",
          p.buildabilityMentions || "",
          p.planningReferences || "",
          p.nativeVegetationReferences || "",
          Number(p.commuteScore) || 0,
          Number(p.commuteTimeAM) || 0,
          Number(p.commuteTimePM) || 0,
          Number(p.landScore) || 0,
          Number(p.budgetScore) || 0,
          Number(p.horseScore) || 0,
          Number(p.buildabilityScore) || 0,
          Number(p.houseSizeScore) || 0,
          Number(p.overallScore) || 0,
          p.profileId || 'farm',
          p.status || "New",
          p.notes || "",
          id,
        ]
      );

      const updated = await db.get("SELECT * FROM properties WHERE id = ?", [id]);
      res.json({
        ...updated,
        images: JSON.parse(updated.images || "[]"),
        existingHouse: updated.existingHouse === 1,
        vacantLand: updated.vacantLand === 1,
        shed: updated.shed === 1,
        dam: updated.dam === 1,
        waterTanks: updated.waterTanks === 1,
        stables: updated.stables === 1,
        horseFacilities: updated.horseFacilities === 1,
        powerConnected: updated.powerConnected === 1,
        septic: updated.septic === 1,
        isNewBuild: updated.isNewBuild === 1,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Delete all properties
  app.delete("/api/properties", async (req, res) => {
    try {
      await db.run("DELETE FROM properties", []);
      res.json({ status: "ok" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Delete property
  app.delete("/api/properties/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM properties WHERE id = ?", [req.params.id]);
      res.json({ status: "ok", id: Number(req.params.id) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Integrate Vite dynamically based on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Property Scout server running on http://localhost:${PORT}`);
  });
}

startServer();
