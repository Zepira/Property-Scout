import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getDb } from "./server/db.js";
import { extractPropertyFromUrl, extractPropertyFromText } from "./server/analyzer.js";
import { calculateScores, geocodeAddress, fetchCommuteTimes } from "./server/scoring.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize SQLite database
  const db = await getDb();

  // API ROUTE: Get all properties
  app.get("/api/properties", async (req, res) => {
    try {
      const properties = await db.all("SELECT * FROM properties ORDER BY id DESC");
      // Map JSON fields back to objects
      const parsedProperties = properties.map((p) => ({
        ...p,
        images: JSON.parse(p.images || "[]"),
        existingHouse: p.existingHouse === 1,
        vacantLand: p.vacantLand === 1,
        shed: p.shed === 1,
        dam: p.dam === 1,
        waterTanks: p.waterTanks === 1,
        stables: p.stables === 1,
        horseFacilities: p.horseFacilities === 1,
        powerConnected: p.powerConnected === 1,
        septic: p.septic === 1,
      }));
      res.json(parsedProperties);
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
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API ROUTE: Scrape property listing URL or manual processing
  app.post("/api/scrape", async (req, res) => {
    const { url, descriptionText, address, price, landSize, bedrooms, bathrooms, carSpaces } = req.body;
    
    try {
      let extracted: any;

      if (url && (url.includes("domain.com.au") || url.includes("realestate.com.au") || url.startsWith("http"))) {
        // Run AI Scraper
        console.log(`Analyzing url via Gemini Grounding: ${url}`);
        extracted = await extractPropertyFromUrl(url);
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
          // Approximate coordinate in South-East Melbourne/Victoria if none resolved
          lat = -40; // Default off-center markers, let client adjust or keep null
          lng = 145;
          
          if (extracted.address.toLowerCase().includes("emerald") || extracted.address.toLowerCase().includes("olinda") || extracted.address.toLowerCase().includes("ranges")) {
            lat = -37.8546; lng = 145.4371; // Dandenong Ranges
          } else if (extracted.address.toLowerCase().includes("pakenham") || extracted.address.toLowerCase().includes("beaconsfield") || extracted.address.toLowerCase().includes("cardinia")) {
            lat = -38.0712; lng = 145.4856; // Cardinia Shire
          } else if (extracted.address.toLowerCase().includes("moorabbin")) {
            lat = -37.947291; lng = 145.064560; // Moorabbin
          } else {
            // General Melb SE
            lat = -38.0163; lng = 145.2148;
          }
        }
      }

      // Let's query Driving/Traffic commute times using Maps API if Key exists
      let commuteTimeAM = 0;
      let commuteTimePM = 0;
      if (lat && lng && mapKey) {
        const commute = await fetchCommuteTimes(lat, lng, mapKey);
        if (commute) {
          commuteTimeAM = commute.timeAM;
          commuteTimePM = commute.timePM;
        }
      }

      // Calculate Scores
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

      const scores = calculateScores(propertyFeatures, lat && lng ? { lat, lng } : null);

      if (commuteTimeAM > 0 && commuteTimePM > 0) {
        scores.commuteTimeAM = commuteTimeAM;
        scores.commuteTimePM = commuteTimePM;
        // Re-score based on accurate maps times
        const avg = (commuteTimeAM + commuteTimePM) / 2;
        let commuteScore = 0;
        if (avg <= 40) commuteScore = 100;
        else if (avg <= 60) commuteScore = 75;
        else if (avg <= 75) commuteScore = 50;
        else if (avg <= 90) commuteScore = 25;
        else commuteScore = 0;
        
        scores.commuteScore = commuteScore;
        scores.overallScore = Math.round(
          commuteScore * 0.35 +
          scores.landScore * 0.25 +
          scores.budgetScore * 0.20 +
          scores.horseScore * 0.10 +
          scores.buildabilityScore * 0.10
        );
      }

      const cleanResult = {
        ...extracted,
        lat,
        lng,
        images: extracted.images && extracted.images.length ? extracted.images : [],
        ...scores,
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

  // API ROUTE: Save new property
  app.post("/api/properties", async (req, res) => {
    const p = req.body;

    try {
      const result = await db.run(
        `INSERT INTO properties (
          url, address, price, landSize, bedrooms, bathrooms, carSpaces, description,
          agentName, agentAgency, agentPhone, images, lat, lng,
          existingHouse, vacantLand, shed, dam, waterTanks, stables, horseFacilities, powerConnected, septic,
          bushfireMentions, buildabilityMentions, planningReferences, nativeVegetationReferences,
          commuteScore, commuteTimeAM, commuteTimePM, landScore, budgetScore, horseScore, buildabilityScore, overallScore,
          status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.url || "",
          p.address,
          Number(p.price) || 0,
          Number(p.landSize) || 0,
          Number(p.bedrooms) || 0,
          Number(p.bathrooms) || 0,
          Number(p.carSpaces) || 0,
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
          Number(p.overallScore) || 0,
          p.status || "New",
          p.notes || "",
        ]
      );

      const savedProperty = await db.get("SELECT * FROM properties WHERE id = ?", [result.lastID]);
      res.json({
        ...savedProperty,
        images: JSON.parse(savedProperty.images || "[]"),
        existingHouse: savedProperty.existingHouse === 1,
        vacantLand: savedProperty.vacantLand === 1,
        shed: savedProperty.shed === 1,
        dam: savedProperty.dam === 1,
        waterTanks: savedProperty.waterTanks === 1,
        stables: savedProperty.stables === 1,
        horseFacilities: savedProperty.horseFacilities === 1,
        powerConnected: savedProperty.powerConnected === 1,
        septic: savedProperty.septic === 1,
      });
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
          url = ?, address = ?, price = ?, landSize = ?, bedrooms = ?, bathrooms = ?, carSpaces = ?, description = ?,
          agentName = ?, agentAgency = ?, agentPhone = ?, images = ?, lat = ?, lng = ?,
          existingHouse = ?, vacantLand = ?, shed = ?, dam = ?, waterTanks = ?, stables = ?, horseFacilities = ?, powerConnected = ?, septic = ?,
          bushfireMentions = ?, buildabilityMentions = ?, planningReferences = ?, nativeVegetationReferences = ?,
          commuteScore = ?, commuteTimeAM = ?, commuteTimePM = ?, landScore = ?, budgetScore = ?, horseScore = ?, buildabilityScore = ?, overallScore = ?,
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
          Number(p.overallScore) || 0,
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
      });
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
