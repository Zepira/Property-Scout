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
