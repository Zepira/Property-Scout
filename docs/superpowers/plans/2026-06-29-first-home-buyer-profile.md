# First Home Buyer Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "First Home Buyer" profile with its own property list, FHB scoring model, Marnebek School commute destination, and scheme-aware financial panel — backed by a real SQLite database replacing the JSON shim.

**Architecture:** The existing `DatabaseInterface` (all/get/run with SQL strings) is preserved but implemented with real SQLite. A `profile_id` column is added to the properties table. Profile selection lives in `localStorage` and is passed as `?profile=` to all API calls. FHB scoring and financial logic are additive — existing farm code is unchanged.

**Tech Stack:** React 19, TypeScript, Express 4, SQLite (`sqlite` + `sqlite3` packages already installed), Tailwind CSS 4, Vite, Google Maps Platform API, Google Gemini AI.

## Global Constraints

- TypeScript strict mode — no new `any` types (match existing code's pattern)
- Dark theme CSS vars: `bg-card-dark`, `bg-bg-dark`, `text-text-main`, `text-text-dim`, `text-accent-dark`, `text-success-dark`, `text-warning-dark`, `text-danger-dark`, `border-border-dark`
- All AUD amounts formatted with `.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })`
- Profile IDs are string literals `'farm' | 'firsthome'` — use the `ProfileId` type, never raw strings
- Existing field names in `Property`: `landSize` (acres), `bedrooms`, `bathrooms`, `carSpaces` — do NOT rename these
- Score fields on `Property` are flat (not nested): `commuteScore`, `landScore`, `budgetScore`, `horseScore`, `buildabilityScore`, `overallScore`, `commuteTimeAM`, `commuteTimePM`

---

### Task 1: Update TypeScript Types

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `ProfileId` type, `Profile` interface, updated `Property` with `profileId`, `garages`, `landSqm`, `isNewBuild`, `houseSizeScore`

---

- [ ] **Step 1: Open `src/types.ts`**

Current `Property` has flat score fields (`commuteScore`, `landScore`, etc.) and feature fields (`bedrooms`, `bathrooms`, `carSpaces`, `landSize`). Add new fields without changing existing ones.

- [ ] **Step 2: Add `ProfileId` and `Profile` types**

At the top of `src/types.ts`, before `PropertyStatus`, add:

```ts
export type ProfileId = 'farm' | 'firsthome';

export interface Profile {
  id: ProfileId;
  name: string;
}
```

- [ ] **Step 3: Add new fields to the `Property` interface**

Inside the `Property` interface, add these fields. Place `profileId` near the top (after `id`), and the FHB-specific fields near the existing score/feature fields:

```ts
// After `id: number;`
profileId: ProfileId;

// After `carSpaces: number;` (keep existing fields, add new ones):
garages?: number;       // FHB: number of garage bays
landSqm?: number;       // FHB: land size in square metres
isNewBuild?: boolean;   // FHB: affects FHOG eligibility

// After `buildabilityScore: number;`
houseSizeScore: number; // FHB only; always 0 for farm profile
```

- [ ] **Step 4: Verify TypeScript compiles with no new errors**

```bash
pnpm tsc --noEmit
```

Expected: exits 0 (or same pre-existing errors — do not introduce new ones).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ProfileId, Profile types and FHB fields to Property"
```

---

### Task 2: SQLite Database Migration

**Files:**
- Modify: `server/db.ts`

**Interfaces:**
- Consumes: `DatabaseInterface` (preserved — same `all/get/run` signature server.ts already uses)
- Produces: real SQLite implementation of `DatabaseInterface`; `getDb()` returns SQLite-backed instance; schema includes `profile_id`, `garages`, `land_sqm`, `is_new_build`, `house_size_score`

---

- [ ] **Step 1: Replace `server/db.ts` with the SQLite implementation**

The `DatabaseInterface` (`all`, `get`, `run`) is preserved identically — `server.ts` SQL strings will work unchanged. Replace the entire file:

```ts
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface DatabaseInterface {
  all(query: string, params?: any[]): Promise<any[]>;
  get(query: string, params?: any[]): Promise<any | undefined>;
  run(query: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

class SQLiteDatabase implements DatabaseInterface {
  constructor(private db: Database) {}

  async all(query: string, params: any[] = []): Promise<any[]> {
    return this.db.all(query, params);
  }

  async get(query: string, params: any[] = []): Promise<any | undefined> {
    return this.db.get(query, params);
  }

  async run(query: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    return this.db.run(query, params);
  }
}

let dbInstance: DatabaseInterface | null = null;

async function initSchema(db: Database): Promise<void> {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id                TEXT NOT NULL DEFAULT 'farm' REFERENCES profiles(id),
      url                       TEXT NOT NULL DEFAULT '',
      address                   TEXT,
      price                     INTEGER DEFAULT 0,
      landSize                  REAL DEFAULT 0,
      bedrooms                  INTEGER DEFAULT 0,
      bathrooms                 INTEGER DEFAULT 0,
      carSpaces                 INTEGER DEFAULT 0,
      garages                   INTEGER DEFAULT 0,
      landSqm                   INTEGER DEFAULT 0,
      isNewBuild                INTEGER NOT NULL DEFAULT 0,
      description               TEXT DEFAULT '',
      agentName                 TEXT DEFAULT '',
      agentAgency               TEXT DEFAULT '',
      agentPhone                TEXT DEFAULT '',
      images                    TEXT DEFAULT '[]',
      lat                       REAL,
      lng                       REAL,
      existingHouse             INTEGER NOT NULL DEFAULT 0,
      vacantLand                INTEGER NOT NULL DEFAULT 0,
      shed                      INTEGER NOT NULL DEFAULT 0,
      dam                       INTEGER NOT NULL DEFAULT 0,
      waterTanks                INTEGER NOT NULL DEFAULT 0,
      stables                   INTEGER NOT NULL DEFAULT 0,
      horseFacilities           INTEGER NOT NULL DEFAULT 0,
      powerConnected            INTEGER NOT NULL DEFAULT 0,
      septic                    INTEGER NOT NULL DEFAULT 0,
      bushfireMentions          TEXT DEFAULT '',
      buildabilityMentions      TEXT DEFAULT '',
      planningReferences        TEXT DEFAULT '',
      nativeVegetationReferences TEXT DEFAULT '',
      commuteScore              INTEGER DEFAULT 0,
      commuteTimeAM             INTEGER DEFAULT 0,
      commuteTimePM             INTEGER DEFAULT 0,
      landScore                 INTEGER DEFAULT 0,
      budgetScore               INTEGER DEFAULT 0,
      horseScore                INTEGER DEFAULT 0,
      buildabilityScore         INTEGER DEFAULT 0,
      houseSizeScore            INTEGER DEFAULT 0,
      overallScore              INTEGER DEFAULT 0,
      status                    TEXT NOT NULL DEFAULT 'New',
      notes                     TEXT DEFAULT '',
      createdAt                 TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.run(`INSERT OR IGNORE INTO profiles VALUES ('farm', 'Farm Property')`);
  await db.run(`INSERT OR IGNORE INTO profiles VALUES ('firsthome', 'First Home Buyer')`);
}

async function migrateLegacyJson(db: Database): Promise<void> {
  const legacyPath = path.join(process.cwd(), 'properties_db.json');
  if (!existsSync(legacyPath)) return;

  const existing = await db.get<{ n: number }>(`SELECT COUNT(*) as n FROM properties`);
  if (existing && existing.n > 0) return;

  try {
    const raw = await fs.readFile(legacyPath, 'utf-8');
    const props = JSON.parse(raw) as any[];
    for (const p of props) {
      await db.run(
        `INSERT INTO properties (
          profile_id, url, address, price, landSize, bedrooms, bathrooms, carSpaces,
          description, agentName, agentAgency, agentPhone, images, lat, lng,
          existingHouse, vacantLand, shed, dam, waterTanks, stables, horseFacilities,
          powerConnected, septic, bushfireMentions, buildabilityMentions,
          planningReferences, nativeVegetationReferences,
          commuteScore, commuteTimeAM, commuteTimePM, landScore, budgetScore,
          horseScore, buildabilityScore, houseSizeScore, overallScore, status, notes, createdAt
        ) VALUES (
          'farm', ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 0, ?, ?, ?, ?
        )`,
        [
          p.url || '', p.address, p.price || 0, p.landSize || 0, p.bedrooms || 0, p.bathrooms || 0, p.carSpaces || 0,
          p.description || '', p.agentName || '', p.agentAgency || '', p.agentPhone || '',
          typeof p.images === 'string' ? p.images : JSON.stringify(p.images || []),
          p.lat ?? null, p.lng ?? null,
          p.existingHouse ? 1 : 0, p.vacantLand ? 1 : 0, p.shed ? 1 : 0, p.dam ? 1 : 0,
          p.waterTanks ? 1 : 0, p.stables ? 1 : 0, p.horseFacilities ? 1 : 0,
          p.powerConnected ? 1 : 0, p.septic ? 1 : 0,
          p.bushfireMentions || '', p.buildabilityMentions || '',
          p.planningReferences || '', p.nativeVegetationReferences || '',
          p.commuteScore || 0, p.commuteTimeAM || 0, p.commuteTimePM || 0,
          p.landScore || 0, p.budgetScore || 0, p.horseScore || 0, p.buildabilityScore || 0,
          p.overallScore || 0, p.status || 'New', p.notes || '',
          p.createdAt || new Date().toISOString(),
        ]
      );
    }
    await fs.rename(legacyPath, legacyPath + '.bak');
    console.log(`Migrated ${props.length} properties from JSON to SQLite`);
  } catch (e) {
    console.error('Legacy migration failed:', e);
  }
}

// Seed the two hard-coded example properties into the farm profile if DB is empty
async function seedFarmProperties(db: Database): Promise<void> {
  const existing = await db.get<{ n: number }>(`SELECT COUNT(*) as n FROM properties WHERE profile_id = 'farm'`);
  if (existing && existing.n > 0) return;

  const seeds = [
    {
      url: 'https://www.realestate.com.au/property-house-vic-emerald-123456789',
      address: '85 Emerald-Monbulk Road, Emerald VIC 3782',
      price: 890000, landSize: 5.5, bedrooms: 4, bathrooms: 2, carSpaces: 3,
      description: 'Superb rural lifestyle property perfect for horse lovers.',
      agentName: 'Sarah Jenkins', agentAgency: 'Dandenong Ranges Real Estate', agentPhone: '+61 412 345 678',
      images: JSON.stringify(['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop']),
      lat: -37.8546, lng: 145.4371,
      existingHouse: 1, vacantLand: 0, shed: 1, dam: 1, waterTanks: 1, stables: 1,
      horseFacilities: 1, powerConnected: 1, septic: 1,
      bushfireMentions: 'Property falls under Bushfire Management Overlay (BMO).',
      buildabilityMentions: 'Slight slope but clear build footprint.',
      planningReferences: 'Zoned Green Wedge Zone (GWZ).',
      nativeVegetationReferences: 'Lush native timber along property borders.',
      commuteScore: 75, commuteTimeAM: 48, commuteTimePM: 56,
      landScore: 60, budgetScore: 78, horseScore: 95, buildabilityScore: 100,
      houseSizeScore: 0, overallScore: 79, status: 'Shortlisted',
      notes: 'Outstanding horse setup. Commute ~48-56 mins.',
    },
    {
      url: 'https://www.domain.com.au/220-cardinia-road-pakenham-vic-3810',
      address: '220 Cardinia Road, Pakenham VIC 3810',
      price: 720000, landSize: 12.0, bedrooms: 0, bathrooms: 0, carSpaces: 0,
      description: 'Premium 12-acre vacant land parcel.',
      agentName: 'Michael Chang', agentAgency: 'Scenic Outpost Sellers', agentPhone: '+61 498 765 432',
      images: JSON.stringify(['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop']),
      lat: -38.0712, lng: 145.4856,
      existingHouse: 0, vacantLand: 1, shed: 1, dam: 1, waterTanks: 0, stables: 0,
      horseFacilities: 1, powerConnected: 0, septic: 0,
      bushfireMentions: 'None. Low risk pasture zone.',
      buildabilityMentions: 'Flat, dry building envelope.',
      planningReferences: 'Zoned Rural Conservation (RCZ).',
      nativeVegetationReferences: 'Clear pasture land.',
      commuteScore: 75, commuteTimeAM: 45, commuteTimePM: 52,
      landScore: 78, budgetScore: 100, horseScore: 70, buildabilityScore: 50,
      houseSizeScore: 0, overallScore: 79, status: 'Interested',
      notes: 'Superb vacant block. Needs septic and water.',
    },
  ];

  for (const s of seeds) {
    await db.run(
      `INSERT INTO properties (
        profile_id, url, address, price, landSize, bedrooms, bathrooms, carSpaces,
        description, agentName, agentAgency, agentPhone, images, lat, lng,
        existingHouse, vacantLand, shed, dam, waterTanks, stables, horseFacilities,
        powerConnected, septic, bushfireMentions, buildabilityMentions,
        planningReferences, nativeVegetationReferences,
        commuteScore, commuteTimeAM, commuteTimePM, landScore, budgetScore,
        horseScore, buildabilityScore, houseSizeScore, overallScore, status, notes
      ) VALUES (
        'farm', ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
      [
        s.url, s.address, s.price, s.landSize, s.bedrooms, s.bathrooms, s.carSpaces,
        s.description, s.agentName, s.agentAgency, s.agentPhone, s.images, s.lat, s.lng,
        s.existingHouse, s.vacantLand, s.shed, s.dam, s.waterTanks, s.stables, s.horseFacilities,
        s.powerConnected, s.septic, s.bushfireMentions, s.buildabilityMentions,
        s.planningReferences, s.nativeVegetationReferences,
        s.commuteScore, s.commuteTimeAM, s.commuteTimePM, s.landScore, s.budgetScore,
        s.horseScore, s.buildabilityScore, s.houseSizeScore, s.overallScore, s.status, s.notes,
      ]
    );
  }
}

export async function getDb(): Promise<DatabaseInterface> {
  if (dbInstance) return dbInstance;

  const db = await open({ filename: './properties.db', driver: sqlite3.Database });
  await initSchema(db);
  await migrateLegacyJson(db);
  await seedFarmProperties(db);

  dbInstance = new SQLiteDatabase(db);
  return dbInstance;
}
```

- [ ] **Step 2: Verify the server starts and `properties.db` is created**

```bash
pnpm dev
```

Expected: Server starts on port 5000. `properties.db` file appears in the project root. Console shows either migration message or seed message.

- [ ] **Step 3: Verify GET /api/properties returns data**

In a separate terminal:
```bash
curl http://localhost:5000/api/properties
```

Expected: JSON array with the 2 seed farm properties (or migrated properties if JSON file existed).

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat: migrate database from JSON shim to real SQLite with profile_id column"
```

---

### Task 3: Profile Config & FHB Scoring

**Files:**
- Modify: `server/scoring.ts`

**Interfaces:**
- Consumes: `ProfileId` from `src/types.ts`
- Produces: `PROFILE_CONFIG` export; updated `fetchCommuteTimes(lat, lng, apiKey, destLat, destLng)` signature; new `calculateFHBScores(features, coordinates)` export

---

- [ ] **Step 1: Add `ProfileId` import and `PROFILE_CONFIG` export to `server/scoring.ts`**

At the top of the file, add the import and replace the hardcoded constants:

```ts
import type { ProfileId } from '../src/types.js';

export const PROFILE_CONFIG: Record<ProfileId, { label: string; lat: number; lng: number }> = {
  farm: {
    label: 'Moorabbin',
    lat: -37.947291,
    lng: 145.064560,
  },
  firsthome: {
    label: 'Marnebek School, Cranbourne',
    lat: -38.1156,
    lng: 145.2831,
  },
};

// Keep these for backwards compat — they now delegate to PROFILE_CONFIG
const MOORABBIN_LAT = PROFILE_CONFIG.farm.lat;
const MOORABBIN_LNG = PROFILE_CONFIG.farm.lng;
```

- [ ] **Step 2: Update `fetchCommuteTimes` to accept destination coordinates**

Change the signature to accept `destLat` and `destLng` parameters with Moorabbin defaults:

```ts
export async function fetchCommuteTimes(
  lat: number,
  lng: number,
  apiKey: string,
  destLat: number = MOORABBIN_LAT,
  destLng: number = MOORABBIN_LNG,
): Promise<{ timeAM: number; timePM: number } | null> {
```

Inside the function, replace both occurrences of `MOORABBIN_LAT` and `MOORABBIN_LNG` in the Routes API request body with `destLat` and `destLng`:

```ts
// In routesDuration() inner function:
destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
```

Also update `calculateScores` to accept an optional destination:

```ts
export function calculateScores(
  features: PropertyFeatures,
  coordinates: { lat: number; lng: number } | null,
  destLat: number = MOORABBIN_LAT,
  destLng: number = MOORABBIN_LNG,
): ScoreBreakdown {
```

Inside `calculateScores`, replace `MOORABBIN_LAT` / `MOORABBIN_LNG` in the Haversine call with `destLat` / `destLng`:

```ts
const straightLineKm = getHaversineDistance(
  coordinates.lat, coordinates.lng, destLat, destLng
);
```

- [ ] **Step 3: Add FHB score types and `calculateFHBScores` function**

Add at the bottom of `server/scoring.ts`:

```ts
export interface FHBPropertyFeatures {
  price: number;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  landSqm: number;
}

export interface FHBScoreBreakdown {
  commuteScore: number;
  commuteTimeAM: number;
  commuteTimePM: number;
  budgetScore: number;
  houseSizeScore: number;
  landScore: number;
  horseScore: 0;
  buildabilityScore: 0;
  overallScore: number;
}

function scoreFHBBudget(price: number): number {
  if (price <= 700000) return 100;
  if (price <= 750000) return 85;
  if (price <= 800000) return 65;
  if (price <= 900000) return 35;
  return 10;
}

function scoreFHBHouseSize(bedrooms: number, bathrooms: number, garages: number): number {
  const bedScore = bedrooms >= 4 ? 100 : bedrooms === 3 ? 75 : bedrooms === 2 ? 40 : 15;
  const bathScore = bathrooms >= 2 ? 100 : bathrooms === 1 ? 55 : 0;
  const garageScore = garages >= 2 ? 100 : garages === 1 ? 70 : 0;
  return Math.round(bedScore * 0.5 + bathScore * 0.3 + garageScore * 0.2);
}

function scoreFHBLand(landSqm: number): number {
  if (landSqm >= 800) return 100;
  if (landSqm >= 600) return 80;
  if (landSqm >= 400) return 60;
  if (landSqm >= 300) return 40;
  return 20;
}

function scoreFHBCommute(avgMins: number): number {
  if (avgMins <= 15) return 100;
  if (avgMins <= 25) return 80;
  if (avgMins <= 35) return 60;
  if (avgMins <= 45) return 35;
  return 10;
}

export function calculateFHBScores(
  features: FHBPropertyFeatures,
  coordinates: { lat: number; lng: number } | null,
  commuteTimeAM = 0,
  commuteTimePM = 0,
): FHBScoreBreakdown {
  let timeAM = commuteTimeAM;
  let timePM = commuteTimePM;

  if (!timeAM && !timePM && coordinates) {
    const dest = PROFILE_CONFIG.firsthome;
    const roadKm = getHaversineDistance(coordinates.lat, coordinates.lng, dest.lat, dest.lng) * 1.25;
    timeAM = Math.max(1, Math.round((roadKm / 72) * 60));
    timePM = Math.max(1, Math.round((roadKm / 55) * 60));
  }

  const avg = (timeAM + timePM) / 2;
  const budget = scoreFHBBudget(features.price);
  const houseSize = scoreFHBHouseSize(features.bedrooms, features.bathrooms, features.garages);
  const land = scoreFHBLand(features.landSqm);
  const commute = scoreFHBCommute(avg);
  const overall = Math.round(budget * 0.35 + houseSize * 0.25 + land * 0.20 + commute * 0.20);

  return {
    commuteScore: commute,
    commuteTimeAM: timeAM,
    commuteTimePM: timePM,
    budgetScore: budget,
    houseSizeScore: houseSize,
    landScore: land,
    horseScore: 0,
    buildabilityScore: 0,
    overallScore: overall,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add server/scoring.ts
git commit -m "feat: add PROFILE_CONFIG, FHB scoring, and profile-aware commute destination"
```

---

### Task 4: API Routes with Profile Support

**Files:**
- Modify: `server.ts`

**Interfaces:**
- Consumes: `PROFILE_CONFIG`, `calculateFHBScores`, updated `fetchCommuteTimes`, `calculateScores` from `server/scoring.ts`; `ProfileId` from `src/types.ts`
- Produces: `GET /api/profiles`; all property routes filter/set `profile_id`; scrape route uses profile-specific commute destination and scoring

---

- [ ] **Step 1: Add `ProfileId` import and update scoring imports in `server.ts`**

At the top of `server.ts`, add to imports:

```ts
import type { ProfileId } from './src/types.js';
import {
  calculateScores, calculateFHBScores, geocodeAddress, fetchCommuteTimes, PROFILE_CONFIG
} from './server/scoring.js';
```

Remove or replace the existing `calculateScores` import if it was already there.

- [ ] **Step 2: Add `GET /api/profiles` route**

Add this route before the existing `GET /api/properties` route:

```ts
app.get('/api/profiles', async (_req, res) => {
  try {
    const profiles = await db.all(`SELECT id, name FROM profiles ORDER BY id`);
    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Update `GET /api/properties` to filter by profile**

Replace the existing handler:

```ts
app.get('/api/properties', async (req, res) => {
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
```

- [ ] **Step 4: Update `GET /api/properties/:id` to include `isNewBuild` in response**

In the existing single-property GET handler, add `isNewBuild: property.isNewBuild === 1` to the spread object alongside the existing boolean conversions.

- [ ] **Step 5: Update `POST /api/scrape` to accept `profileId` and use profile-aware scoring**

In the `/api/scrape` handler, read `profileId` from the request body early:

```ts
const profileId: ProfileId = req.body.profileId || 'farm';
const garages = Number(req.body.garages) || 0;
const landSqm = Number(req.body.landSqm) || 0;
const isNewBuild = Boolean(req.body.isNewBuild);
```

After geocoding, use the profile's destination for commute calculation:

```ts
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
```

After commute, choose the scoring function based on profile:

```ts
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
    const avg = (commuteTimeAM + commuteTimePM) / 2;
    let cs = 0;
    if (avg <= 40) cs = 100;
    else if (avg <= 60) cs = 75;
    else if (avg <= 75) cs = 50;
    else if (avg <= 90) cs = 25;
    scores.commuteScore = cs;
    scores.overallScore = Math.round(
      cs * 0.35 + scores.landScore * 0.25 + scores.budgetScore * 0.20 +
      scores.horseScore * 0.10 + scores.buildabilityScore * 0.10
    );
  }
  scores.houseSizeScore = 0;
}
```

Include `profileId`, `garages`, `landSqm`, `isNewBuild` in `cleanResult`:

```ts
const cleanResult = {
  ...extracted,
  lat, lng,
  images: mergedImages,
  ...scores,
  profileId,
  garages,
  landSqm,
  isNewBuild,
  status: 'New',
  notes: '',
  url: url || '',
};
```

- [ ] **Step 6: Update `POST /api/properties` (save/upsert) to persist `profile_id`, `garages`, `landSqm`, `isNewBuild`, `houseSizeScore`**

In the existing INSERT SQL inside `POST /api/properties`, add the new columns. Find the large INSERT statement and add after `url`:

```ts
// Read from request body
const profileId: ProfileId = p.profileId || 'farm';
const garages = Number(p.garages) || 0;
const landSqm = Number(p.landSqm) || 0;
const isNewBuild = p.isNewBuild ? 1 : 0;
const houseSizeScore = Number(p.houseSizeScore) || 0;
```

Update the INSERT SQL to add these 5 columns (add them after the existing column list, adjusting positional params accordingly). The new INSERT should include `profile_id, garages, landSqm, isNewBuild, houseSizeScore` columns and their corresponding `?` placeholders and param values.

Do the same for the UPDATE SQL in `PUT /api/properties/:id`.

Also add `isNewBuild: p.isNewBuild === 1` to both response objects (GET single + POST response).

- [ ] **Step 7: Remove the 5-second polling fallback to plain `/api/properties` in App.tsx**

The polling in App.tsx (the `setInterval`) currently calls `/api/properties` without a `?profile=` param — this will need to be updated in Task 5 when profile state is added. Note this for Task 5.

- [ ] **Step 8: Verify API routes work**

```bash
# Start server
pnpm dev

# In another terminal:
curl http://localhost:5000/api/profiles
# Expected: [{"id":"farm","name":"Farm Property"},{"id":"firsthome","name":"First Home Buyer"}]

curl "http://localhost:5000/api/properties?profile=farm"
# Expected: JSON array with farm properties

curl "http://localhost:5000/api/properties?profile=firsthome"
# Expected: []
```

- [ ] **Step 9: Commit**

```bash
git add server.ts
git commit -m "feat: profile-aware API routes — GET /api/profiles and ?profile= filter"
```

---

### Task 5: ProfileSelector Component + App Profile State

**Files:**
- Create: `src/components/ProfileSelector.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Profile`, `ProfileId` from `src/types.ts`; `GET /api/profiles`; `GET /api/properties?profile=`
- Produces: `ProfileSelector` component; `activeProfile: ProfileId` state in App passed to all child components

---

- [ ] **Step 1: Create `src/components/ProfileSelector.tsx`**

```tsx
import { Profile, ProfileId } from '../types';

interface Props {
  profiles: Profile[];
  activeProfile: ProfileId;
  onChange: (id: ProfileId) => void;
}

export function ProfileSelector({ profiles, activeProfile, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dark">
      <span className="text-[10px] font-semibold text-text-dim uppercase tracking-widest whitespace-nowrap">
        Profile
      </span>
      <select
        value={activeProfile}
        onChange={e => onChange(e.target.value as ProfileId)}
        className="flex-1 bg-bg-dark text-text-main border border-border-dark rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-dark cursor-pointer"
      >
        {profiles.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Add profile state and fetch to `src/App.tsx`**

Read the file first, then make these changes:

Add imports at the top:
```ts
import { ProfileSelector } from './components/ProfileSelector';
import { Profile, ProfileId } from './types';
```

Add state inside the `App` component, after existing `useState` declarations:
```ts
const [profiles, setProfiles] = useState<Profile[]>([]);
const [activeProfile, setActiveProfile] = useState<ProfileId>(() =>
  (localStorage.getItem('property-scout-profile') as ProfileId) ?? 'farm'
);
```

Add a `useEffect` to fetch profiles once on mount (add alongside the existing `useEffect`):
```ts
useEffect(() => {
  fetch('/api/profiles').then(r => r.json()).then(setProfiles);
}, []);
```

Replace the existing properties `useEffect` and `loadProperties` function so they include the profile param:

```ts
useEffect(() => {
  loadProperties(activeProfile);
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/properties?profile=${activeProfile}`);
      const data = await res.json();
      setProperties((prev) => {
        if (data.length !== prev.length) {
          const newOnes = data.filter((d: Property) => !prev.find((p) => p.id === d.id));
          if (newOnes.length > 0) setSelectedPropertyId(newOnes[0].id);
        }
        return data;
      });
    } catch {}
  }, 5000);
  return () => clearInterval(interval);
}, [activeProfile]);

const loadProperties = async (profile: ProfileId) => {
  setLoading(true);
  try {
    const res = await fetch(`/api/properties?profile=${profile}`);
    const data = await res.json();
    setProperties(data);
    if (data.length > 0) {
      setSelectedPropertyId(data[0].id);
    } else {
      setSelectedPropertyId(null);
    }
  } catch (error) {
    console.error('Failed to load properties', error);
  } finally {
    setLoading(false);
  }
};
```

Add a profile change handler:
```ts
const handleProfileChange = (profileId: ProfileId) => {
  localStorage.setItem('property-scout-profile', profileId);
  setActiveProfile(profileId);
  setSelectedPropertyId(null);
  setComparisonIds([]);
  setShowComparison(false);
  setShowAddForm(false);
};
```

- [ ] **Step 3: Render `<ProfileSelector>` in the JSX**

Find the left panel / sidebar in the JSX return. Add `<ProfileSelector>` as the very first element inside the left panel (above the search input and sort controls):

```tsx
<ProfileSelector
  profiles={profiles}
  activeProfile={activeProfile}
  onChange={handleProfileChange}
/>
```

- [ ] **Step 4: Pass `activeProfile` to all child components that need it**

Find every usage of `<PropertyCard>`, `<PropertyDetail>`, `<PropertyForm>`, `<FinancialCalculator>`, `<ComparisonView>`, `<PropertyMap>` in App.tsx's JSX. Add `activeProfile={activeProfile}` as a prop. The components don't consume it yet — that's fine, TypeScript won't error if you add an unrecognised prop at this stage (unless strict). You can add it in subsequent tasks as the components accept it.

Note: `PropertyDetail` renders `FinancialCalculator` internally — check whether the `activeProfile` prop needs to be threaded through `PropertyDetail` to reach `FinancialCalculator`.

- [ ] **Step 5: Verify in browser**

```bash
pnpm dev
```

Open `http://localhost:5173`. Expected:
- Dropdown appears at the top of the left panel with "Farm Property" / "First Home Buyer"
- Switching to "First Home Buyer" shows an empty property list
- Refreshing the page remembers the last selected profile

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileSelector.tsx src/App.tsx
git commit -m "feat: ProfileSelector component and profile state in App"
```

---

### Task 6: Property Form FHB Mode

**Files:**
- Modify: `src/components/PropertyForm.tsx`

**Interfaces:**
- Consumes: `activeProfile: ProfileId` prop
- Produces: profile-aware form — FHB mode shows `garages`, `landSqm`, `isNewBuild`; hides horse/farm fields; includes `profileId` in submission payload

---

- [ ] **Step 1: Read `src/components/PropertyForm.tsx` in full**

Identify: (a) where the form state is declared, (b) where horse/farm-specific fields are rendered (dam, stables, horseFacilities, etc.), (c) where the form data is sent to `/api/scrape`.

- [ ] **Step 2: Add `activeProfile` prop to `PropertyForm`**

Find the existing props interface (or function signature) and add:

```ts
activeProfile: ProfileId;
```

Import `ProfileId` at the top:
```ts
import { ProfileId } from '../types';
```

- [ ] **Step 3: Add FHB fields to form state**

In the form state initialiser (the `useState` object), add:
```ts
garages: 0,
landSqm: 0,
isNewBuild: false,
```

- [ ] **Step 4: Wrap farm-only fields in a conditional**

Find the section that renders horse/dam/stables/shed/power/septic/waterTanks fields. Wrap them:

```tsx
{activeProfile === 'farm' && (
  <>
    {/* existing horse facilities, dam, stables, shed, power, septic, water tank fields */}
  </>
)}
```

- [ ] **Step 5: Add FHB-only fields in a conditional**

In the same tab/section (after the land size field), add:

```tsx
{activeProfile === 'firsthome' && (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs text-text-dim block">
        Garages
        <input
          type="number" min={0} max={6}
          value={form.garages}
          onChange={e => setForm(f => ({ ...f, garages: Number(e.target.value) }))}
          className="mt-1 w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-dark"
        />
      </label>
      <label className="text-xs text-text-dim block">
        Land size (m²)
        <input
          type="number" min={0}
          value={form.landSqm}
          onChange={e => setForm(f => ({ ...f, landSqm: Number(e.target.value) }))}
          className="mt-1 w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-dark"
        />
      </label>
    </div>
    <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
      <input
        type="checkbox"
        checked={form.isNewBuild}
        onChange={e => setForm(f => ({ ...f, isNewBuild: e.target.checked }))}
        className="w-4 h-4 accent-accent-dark"
      />
      New build <span className="text-xs text-text-dim">(affects $10k FHOG eligibility)</span>
    </label>
  </div>
)}
```

- [ ] **Step 6: Update the land label to show the correct unit**

Find the land size label:
```tsx
<label className="text-xs text-text-dim block">
  Land Size ({activeProfile === 'firsthome' ? 'm²' : 'acres'})
  ...
</label>
```

- [ ] **Step 7: Include `profileId`, `garages`, `landSqm`, `isNewBuild` in the submission payload**

Find where the form calls `fetch('/api/scrape', ...)` or passes data to the parent's `onPropertyCreated` handler. Ensure the payload object includes:

```ts
profileId: activeProfile,
garages: form.garages,
landSqm: form.landSqm,
isNewBuild: form.isNewBuild,
```

- [ ] **Step 8: Verify in browser**

Switch to "First Home Buyer" profile, click Add Property, open the manual/form tab.  
Expected: Horse/dam/stables fields are gone; garages, land (m²), and new build checkbox appear.  
Switch back to "Farm Property" — farm fields return.

- [ ] **Step 9: Commit**

```bash
git add src/components/PropertyForm.tsx
git commit -m "feat: profile-aware property form — FHB fields shown/hidden by profile"
```

---

### Task 7: FHB Financial Panel

**Files:**
- Modify: `src/components/FinancialCalculator.tsx`

**Interfaces:**
- Consumes: updated props `{ price: number; isNewBuild?: boolean; bedrooms?: number; bathrooms?: number; garages?: number; landSqm?: number; activeProfile: ProfileId }`
- Produces: FHB mode renders scheme eligibility + FHB stamp duty + cash breakdown + rental offset; farm mode renders existing calculator unchanged

---

- [ ] **Step 1: Read `src/components/FinancialCalculator.tsx` in full**

Note: the existing exported function `calculateVicStampDuty` already handles standard brackets. The FHB mode will use a different function (`calcFHBDuty`) that applies the concession.

- [ ] **Step 2: Update the props interface**

Replace `FinancialCalculatorProps`:

```ts
interface FinancialCalculatorProps {
  price: number;
  isNewBuild?: boolean;
  activeProfile: ProfileId;
}
```

Add import at top:
```ts
import { ProfileId } from '../types';
```

- [ ] **Step 3: Add FHB stamp duty helpers**

Add these pure functions above the component (keep `calculateVicStampDuty` unchanged — it's exported and used elsewhere):

```ts
function calcFHBDuty(price: number): number {
  const full = calculateVicStampDuty(price);
  if (price <= 600000) return 0;
  if (price <= 750000) {
    const concession = full * ((750000 - price) / 150000);
    return Math.round(full - concession);
  }
  return Math.round(full);
}

function calcFHBDutySaving(price: number): number {
  return Math.round(calculateVicStampDuty(price) - calcFHBDuty(price));
}

function calcLMI(loanAmount: number, lvr: number): number {
  if (lvr <= 0.80) return 0;
  if (lvr <= 0.85) return Math.round(loanAmount * 0.006);
  if (lvr <= 0.90) return Math.round(loanAmount * 0.012);
  if (lvr <= 0.95) return Math.round(loanAmount * 0.028);
  return Math.round(loanAmount * 0.038);
}

function monthlyRepayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}
```

- [ ] **Step 4: Add the `SchemePanel` internal component**

Add above the main `FinancialCalculator` export:

```tsx
function SchemePanel({ price, isNewBuild }: { price: number; isNewBuild: boolean }) {
  const fmt = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const fhgEligible = price <= 800000;
  const dutyExempt = price <= 600000;
  const dutyConcession = price > 600000 && price <= 750000;
  const fhogEligible = isNewBuild && price <= 750000;
  const dutySaving = calcFHBDutySaving(price);

  const schemes = [
    {
      label: 'First Home Guarantee',
      detail: '5% deposit · no LMI · 35,000 places/yr nationally',
      status: fhgEligible ? 'green' : 'grey' as const,
      note: fhgEligible
        ? 'Eligible (Vic metro cap $800k) — verify income ≤ $125k single / $200k couple'
        : 'Over Vic metro cap of $800k',
    },
    {
      label: 'Stamp Duty',
      detail: dutyExempt ? 'Full exemption' : dutyConcession ? `Concession — save ${fmt(dutySaving)}` : 'Full standard duty',
      status: (dutyExempt ? 'green' : dutyConcession ? 'amber' : 'grey') as const,
      note: dutyExempt
        ? 'Full exemption — property ≤ $600k'
        : dutyConcession
        ? `Sliding concession for $600k–$750k — duty payable: ${fmt(calcFHBDuty(price))}`
        : 'Above $750k — no FHB stamp duty concession',
    },
    {
      label: 'First Home Owner Grant',
      detail: '$10,000 at settlement — new builds only, ≤ $750k',
      status: (fhogEligible ? 'green' : 'grey') as const,
      note: fhogEligible
        ? 'Eligible — new build ≤ $750k'
        : isNewBuild
        ? 'New build but over $750k cap'
        : 'Established property — FHOG not available',
    },
    {
      label: 'Help to Buy',
      detail: `Govt equity ${isNewBuild ? '40%' : '30%'} · income ≤ $90k single / $120k couple`,
      status: (price <= 950000 ? 'amber' : 'grey') as const,
      note: price <= 950000
        ? 'May be eligible — verify current availability at housingaustralia.gov.au'
        : 'Over $950k price cap',
    },
  ];

  const iconClass = { green: 'text-success-dark', amber: 'text-warning-dark', grey: 'text-text-dim' } as const;
  const icon = { green: '✓', amber: '⚠', grey: '✗' } as const;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-accent-dark uppercase tracking-wider">Scheme Eligibility</h4>
      {schemes.map(s => (
        <div key={s.label} className="flex gap-3 items-start p-2.5 rounded-lg bg-bg-dark border border-border-dark">
          <span className={`text-base font-bold mt-0.5 ${iconClass[s.status]}`}>{icon[s.status]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-main">{s.label}</div>
            <div className="text-xs text-text-dim mt-0.5">{s.detail}</div>
            <div className={`text-xs mt-0.5 ${iconClass[s.status]}`}>{s.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Add FHB state to the main component**

Inside `FinancialCalculator`, after the existing `depositPct` state, add:

```ts
const [useHelpToBuy, setUseHelpToBuy] = useState(false);
const [roomRentalWeekly, setRoomRentalWeekly] = useState(400);
```

- [ ] **Step 6: Add the FHB render branch**

At the top of the component's return statement, before the existing JSX, add:

```tsx
if (activeProfile === 'firsthome') {
  const fmt = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const deposit = Math.round(price * depositPct / 100);
  const helpToBuyEquity = useHelpToBuy ? Math.round(price * (isNewBuild ? 0.40 : 0.30)) : 0;
  const loanAmount = Math.max(0, price - deposit - helpToBuyEquity);
  const lvr = price > 0 ? loanAmount / price : 0;
  const fhgEligible = price <= 800000;
  const usingFHG = fhgEligible && depositPct === 5;
  const lmi = (usingFHG || depositPct >= 20 || useHelpToBuy) ? 0 : calcLMI(loanAmount, lvr);
  const duty = calcFHBDuty(price);
  const fhogOffset = (isNewBuild && price <= 750000) ? 10000 : 0;
  const totalCash = deposit + duty + 2500 + 800 + lmi - fhogOffset;
  const rentalOffsetMonthly = Math.round((roomRentalWeekly * 52) / 12);
  const rates = [0.055, 0.06, 0.065] as const;
  const terms = [25, 30] as const;

  return (
    <div className="bg-card-dark border border-border-dark rounded-xl overflow-hidden shadow-lg animate-fade-in">
      <div className="bg-bg-dark border-b border-border-dark px-5 py-4">
        <h3 className="font-semibold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wide">
          <svg className="w-4 h-4 text-success-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          First Home Buyer Financials
        </h3>
      </div>

      <div className="p-5 space-y-6">
        <SchemePanel price={price} isNewBuild={isNewBuild ?? false} />

        {/* Deposit + Help to Buy controls */}
        <div>
          <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2 block">
            Deposit Percentage
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {([5, 10, 20] as const).map(pct => (
              <button
                key={pct}
                onClick={() => setDepositPct(pct)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  depositPct === pct
                    ? 'bg-accent-dark border-accent-dark text-bg-dark shadow-md'
                    : 'bg-bg-dark border-border-dark text-text-dim hover:bg-slate-800/60 hover:text-text-main'
                }`}
              >
                {pct}% ({fmt(deposit)})
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
            <input
              type="checkbox"
              checked={useHelpToBuy}
              onChange={e => setUseHelpToBuy(e.target.checked)}
              className="w-4 h-4 accent-accent-dark"
            />
            Using Help to Buy <span className="text-xs text-text-dim">(govt {isNewBuild ? '40%' : '30%'} equity — verify eligibility)</span>
          </label>
        </div>

        {/* Cash required breakdown */}
        <div className="bg-bg-dark rounded-xl p-4 border border-border-dark">
          <h4 className="text-xs font-bold text-accent-dark uppercase tracking-wider mb-3">
            Estimated Cash Required
          </h4>
          <div className="space-y-2 text-xs">
            {[
              ['Deposit', fmt(deposit)],
              ['Stamp duty (FHB rate)', fmt(duty)],
              ['Legal / conveyancing', fmt(2500)],
              ['Building & pest inspection', fmt(800)],
              ...(lmi > 0 ? [['LMI (estimated)', fmt(lmi)]] : []),
              ...(fhogOffset > 0 ? [['FHOG offset (new build)', `−${fmt(fhogOffset)}`]] : []),
              ...(useHelpToBuy ? [['Help to Buy equity', `−${fmt(helpToBuyEquity)}`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-text-dim">
                <span>{label}</span>
                <span className="font-mono font-semibold text-text-main">{value}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border-dark pt-2 text-sm font-bold">
              <span className="text-success-dark">Total cash required</span>
              <span className="font-mono text-success-dark">{fmt(totalCash)}</span>
            </div>
          </div>
        </div>

        {/* Loan + repayments */}
        <div className="flex justify-between items-center text-xs border border-border-dark p-2.5 rounded-lg bg-bg-dark">
          <span className="text-text-dim font-medium uppercase tracking-wider">Loan principal</span>
          <span className="font-bold text-text-main font-mono text-sm">{fmt(loanAmount)}</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3 block">
            Monthly Repayments
          </label>
          <div className="overflow-x-auto border border-border-dark rounded-lg">
            <table className="min-w-full text-xs text-left divide-y divide-border-dark">
              <thead className="bg-bg-dark">
                <tr>
                  <th className="px-3 py-2 text-text-dim font-bold">Term / Rate</th>
                  {rates.map(r => (
                    <th key={r} className="px-3 py-2 text-text-dim font-bold text-right">{(r * 100).toFixed(1)}%</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark font-mono bg-card-dark text-text-main">
                {terms.map(t => (
                  <tr key={t}>
                    <td className="px-3 py-2 text-text-main font-sans font-semibold bg-bg-dark/40">{t} Years</td>
                    {rates.map(r => {
                      const mo = monthlyRepayment(loanAmount, r, t);
                      const wk = Math.round((mo * 12) / 52);
                      return (
                        <td key={r} className="px-3 py-2 text-right">
                          <div className="text-text-main font-bold">{fmt(mo)}/mo</div>
                          <div className="text-text-dim text-[10px]">{fmt(wk)}/wk</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rental offset */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-dim">Weekly rental income</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dim">$</span>
              <input
                type="number" min={0} step={50}
                value={roomRentalWeekly}
                onChange={e => setRoomRentalWeekly(Number(e.target.value))}
                className="w-20 bg-bg-dark border border-border-dark rounded px-2 py-0.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-dark"
              />
            </div>
            <span className="text-xs text-text-dim">= {fmt(rentalOffsetMonthly)}/mo offset</span>
          </div>
          <div className="mt-1.5 text-xs text-text-dim">
            Effective cost at 6.0% / 30yr with rental:{' '}
            <span className="text-success-dark font-mono font-semibold">
              {fmt(monthlyRepayment(loanAmount, 0.06, 30) - rentalOffsetMonthly)}/mo
            </span>
          </div>
          <p className="text-[10px] text-text-dim mt-2 italic">Rates are indicative only. LMI cost is estimated — get a lender quote.</p>
        </div>
      </div>
    </div>
  );
}
```

The existing JSX (after this new branch) is the farm calculator — leave it unchanged. Close the `if` block so the farm calculator renders for `activeProfile === 'farm'`.

- [ ] **Step 7: Check how `FinancialCalculator` is called in `PropertyDetail.tsx`**

Read `src/components/PropertyDetail.tsx` and find where `<FinancialCalculator price={...} />` is called. Update the call to pass the new required props:

```tsx
<FinancialCalculator
  price={property.price}
  isNewBuild={property.isNewBuild}
  activeProfile={activeProfile}
/>
```

Add `activeProfile: ProfileId` to `PropertyDetail`'s own props interface and thread it through.

- [ ] **Step 8: Verify in browser**

Switch to "First Home Buyer" profile. Add a property manually with price $700,000, established.  
Expected:
- Scheme panel: ✓ First Home Guarantee, ⚠ Stamp Duty (concession ~$12k saving), ✗ FHOG (established), ⚠ Help to Buy
- Cash breakdown at 10% deposit: deposit $70k + stamp duty ~$24,713 + $2,500 + $800 = ~$98k
- Repayment table: at 6.0%/30yr with $630k loan: ~$3,777/mo
- Rental offset at $400/wk = $1,733/mo → effective ~$2,044/mo

Switch back to "Farm Property" — existing calculator renders unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/components/FinancialCalculator.tsx src/components/PropertyDetail.tsx
git commit -m "feat: FHB financial panel with scheme eligibility, cash breakdown, and rental offset"
```

---

### Task 8: Profile-Aware Score Labels, Detail View & Map

**Files:**
- Create: `src/config.ts`
- Modify: `src/components/PropertyCard.tsx`
- Modify: `src/components/PropertyDetail.tsx`
- Modify: `src/components/PropertyMap.tsx`

**Interfaces:**
- Consumes: `activeProfile: ProfileId` prop on all three; `PROFILE_CONFIG` and `SCORE_LABELS` from `src/config.ts`
- Produces: correct score labels per profile in cards and detail view; correct workplace marker in map

---

- [ ] **Step 1: Create `src/config.ts`**

```ts
import { ProfileId } from './types';

export const PROFILE_CONFIG: Record<ProfileId, { label: string; lat: number; lng: number }> = {
  farm: {
    label: 'Moorabbin',
    lat: -37.947291,
    lng: 145.064560,
  },
  firsthome: {
    label: 'Marnebek School, Cranbourne',
    lat: -38.1156,
    lng: 145.2831,
  },
};

export const SCORE_LABELS: Record<ProfileId, {
  commute: string;
  land: string;
  budget: string;
  primary: string;
  primaryScore: (p: { horseScore: number; houseSizeScore: number }) => number;
  showSecondary: boolean;
  secondary: string;
}> = {
  farm: {
    commute: 'Commute',
    land: 'Land',
    budget: 'Budget',
    primary: 'Horse',
    primaryScore: p => p.horseScore,
    showSecondary: true,
    secondary: 'Build',
  },
  firsthome: {
    commute: 'Commute',
    land: 'Land Size',
    budget: 'Budget',
    primary: 'House',
    primaryScore: p => p.houseSizeScore,
    showSecondary: false,
    secondary: '',
  },
};
```

- [ ] **Step 2: Update `PropertyCard.tsx`**

Read the file. Find where score badges/pills are rendered (the `commuteScore`, `landScore`, `budgetScore`, `horseScore`, `buildabilityScore` labels).

Add import:
```ts
import { SCORE_LABELS } from '../config';
import { ProfileId } from '../types';
```

Add `activeProfile: ProfileId` to the card's props.

Replace hardcoded score label strings with `SCORE_LABELS[activeProfile].X`:

```tsx
// Where "Horse" label appears:
{SCORE_LABELS[activeProfile].primary}: {SCORE_LABELS[activeProfile].primaryScore(property)}

// Where "Build" / buildabilityScore appears — wrap in conditional:
{SCORE_LABELS[activeProfile].showSecondary && (
  <span>Build: {property.buildabilityScore}</span>
)}

// Replace "Land" with:
{SCORE_LABELS[activeProfile].land}: {property.landScore}

// Replace "Commute" with:
{SCORE_LABELS[activeProfile].commute}: {property.commuteScore}

// Replace "Budget" with:
{SCORE_LABELS[activeProfile].budget}: {property.budgetScore}
```

- [ ] **Step 3: Update `PropertyDetail.tsx`**

Read the file. Find the score breakdown section (where it shows commute score details, land score, horse score, buildability score panels).

Add import:
```ts
import { SCORE_LABELS } from '../config';
```

Add `activeProfile: ProfileId` to the component's props.

For the horse/house score panel:
```tsx
<div className="...">
  <span>{SCORE_LABELS[activeProfile].primary}</span>
  <span>{SCORE_LABELS[activeProfile].primaryScore(property)}</span>
</div>
```

Wrap the buildability score panel in:
```tsx
{activeProfile === 'farm' && (
  <div>... buildabilityScore ...</div>
)}
```

Update land label to `SCORE_LABELS[activeProfile].land`.

- [ ] **Step 4: Update `PropertyMap.tsx`**

Read the file. Find where the workplace marker is rendered (currently hardcoded Moorabbin coordinates and label).

Add import:
```ts
import { PROFILE_CONFIG } from '../config';
import { ProfileId } from '../types';
```

Add `activeProfile: ProfileId` to the component's props.

Replace the hardcoded workplace marker with:
```tsx
const workplace = PROFILE_CONFIG[activeProfile];
// Use workplace.lat, workplace.lng, workplace.label for the marker
```

- [ ] **Step 5: Make sure `App.tsx` passes `activeProfile` to `PropertyCard` in the list render**

In App.tsx, find the `.map()` that renders `<PropertyCard>` for each property. Add `activeProfile={activeProfile}`.

- [ ] **Step 6: Verify in browser**

**Farm profile:** property cards show "Horse: X" and "Build: X"; map marker is labelled "Moorabbin".

**First Home Buyer profile:** property cards show "House: X", no Build pill; land label is "Land Size"; map marker is labelled "Marnebek School, Cranbourne".

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/components/PropertyCard.tsx src/components/PropertyDetail.tsx src/components/PropertyMap.tsx src/App.tsx
git commit -m "feat: profile-aware score labels and map workplace marker"
```

---

## Self-Review

**Spec coverage:**
- ✅ SQLite migration — Task 2
- ✅ Separate property lists — Task 4 (`profile_id` column + `?profile=` filter)
- ✅ Profile dropdown — Task 5
- ✅ localStorage persistence — Task 5
- ✅ FHB commute to Marnebek School — Task 3 (`PROFILE_CONFIG.firsthome`)
- ✅ FHB scoring model (Budget 35%, House 25%, Land 20%, Commute 20%) — Task 3 (`calculateFHBScores`)
- ✅ Profile-aware form fields — Task 6
- ✅ Scheme eligibility panel — Task 7 (`SchemePanel`)
- ✅ FHB stamp duty concession formula — Task 7 (`calcFHBDuty`)
- ✅ Cash required breakdown — Task 7
- ✅ Monthly repayments — Task 7
- ✅ Rental income offset — Task 7
- ✅ Profile-aware score labels in cards — Task 8
- ✅ Profile-aware score breakdown in detail view — Task 8
- ✅ Profile-aware map workplace marker — Task 8
- ✅ `is_new_build` in schema — Task 2

**Type consistency:**
- `ProfileId` defined Task 1, used Tasks 2–8 ✅
- `Property.houseSizeScore` defined Task 1, populated in Task 3, persisted in Task 2, read in Tasks 7–8 ✅
- `Property.profileId`, `.garages`, `.landSqm`, `.isNewBuild` defined Task 1, added to schema Task 2, API Task 4, form Task 6, calculator Task 7 ✅
- `PROFILE_CONFIG` in `server/scoring.ts` (Task 3) and `src/config.ts` (Task 8) — same shape, separate files for server/client isolation ✅
- `fetchCommuteTimes(lat, lng, apiKey, destLat, destLng)` updated Task 3, called with profile dest in Task 4 ✅
- `calculateFHBScores` defined Task 3, imported and called in Task 4 ✅
- `SchemePanel`, `calcFHBDuty`, `calcLMI`, `monthlyRepayment` defined and used within Task 7 ✅
- `SCORE_LABELS` defined Task 8 step 1, used steps 2–3 ✅
