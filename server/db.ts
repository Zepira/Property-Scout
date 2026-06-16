import fs from "fs/promises";
import path from "path";

// Define a unified interface for database actions
export interface DatabaseInterface {
  all(query: string, params?: any[]): Promise<any[]>;
  get(query: string, params?: any[]): Promise<any | undefined>;
  run(query: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

let dbInstance: DatabaseInterface | null = null;

// Initial high-quality Victorian seed properties
const SEED_PROPERTIES = [
  {
    url: "https://www.realestate.com.au/property-house-vic-emerald-123456789",
    address: "85 Emerald-Monbulk Road, Emerald VIC 3782",
    price: 890000,
    landSize: 5.5,
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 3,
    description: "Superb rural lifestyle property perfect for horse lovers. Nestled in the stunning Dandenong Ranges, this beautiful 5.5-acre property features cleared pastures, 2 fenced paddocks, high-quality horse fencing, water tanks, stables and a large machinery shed. The spacious 4-bedroom family residence boasts floor-to-ceiling windows with panoramic forest views, a cozy wood fireplace, and modern amenities including connected mains power and an efficient septic system. Only minutes from Emerald township, local schools, and cafes, with a scenic drive to Moorabbin.",
    agentName: "Sarah Jenkins",
    agentAgency: "Dandenong Ranges Real Estate",
    agentPhone: "+61 412 345 678",
    images: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop"],
    lat: -37.8546,
    lng: 145.4371,
    existingHouse: 1,
    vacantLand: 0,
    shed: 1,
    dam: 1,
    waterTanks: 1,
    stables: 1,
    horseFacilities: 1,
    powerConnected: 1,
    septic: 1,
    bushfireMentions: "Property falls under Bushfire Management Overlay (BMO). Appropriate clearing zones around home are well-maintained.",
    buildabilityMentions: "Slight slope but clear build footprint. Large existing house in pristine structural condition.",
    planningReferences: "Zoned Green Wedge Zone (GWZ) which limits subdivision but fully permits agriculture and residential improvements. Pre-approved permit for the stable block.",
    nativeVegetationReferences: "Lush native timber along property borders. Front acreage is cleared pasture, preserving native trees.",
    commuteScore: 75,
    commuteTimeAM: 48,
    commuteTimePM: 56,
    landScore: 60,
    budgetScore: 78,
    horseScore: 95,
    buildabilityScore: 100,
    overallScore: 79,
    status: "Shortlisted",
    notes: "Outstanding horse setup with stables and dams. Family home is ready-to-move-in. Commute to Moorabbin is very reasonable at 48-56 mins off-peak."
  },
  {
    url: "https://www.domain.com.au/220-cardinia-road-pakenham-vic-3810",
    address: "220 Cardinia Road, Pakenham VIC 3810",
    price: 720000,
    landSize: 12.0,
    bedrooms: 0,
    bathrooms: 0,
    carSpaces: 0,
    description: "Attention equine enthusiasts and builders! Premium 12-acre vacant land parcel with spectacular panoramic views overlooking Cardinia Shire. Totally clear, rich fertile soil ideal for grazing, crop growing, or establishing professional horse facilities. Fully fenced boundary with secure gates. Includes a massive 3-bay steel workshop/shed and a deep catchment dam. Mains power is available directly at the boundary gate ready for connection. Needs septic installation if building. Private gate access, quiet country road.",
    agentName: "Michael Chang",
    agentAgency: "Scenic Outpost Sellers",
    agentPhone: "+61 498 765 432",
    images: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop"],
    lat: -38.0712,
    lng: 145.4856,
    existingHouse: 0,
    vacantLand: 1,
    shed: 1,
    dam: 1,
    waterTanks: 0,
    stables: 0,
    horseFacilities: 1,
    powerConnected: 0,
    septic: 0,
    bushfireMentions: "None. Low risk pasture zone.",
    buildabilityMentions: "Flat, dry building envelope with excellent soil profile and no restrictive easements. Ideal for building a dream ranch.",
    planningReferences: "Zoned Rural Conservation (RCZ). Ready for house construction (STCA) with pristine building zones designated by shire council.",
    nativeVegetationReferences: "Clear pasture land with zero heavy vegetation clearance restrictions or tree protection overlays.",
    commuteScore: 75,
    commuteTimeAM: 45,
    commuteTimePM: 52,
    landScore: 78,
    budgetScore: 100,
    horseScore: 70,
    buildabilityScore: 50,
    overallScore: 79,
    status: "Interested",
    notes: "Superb vacant block with huge land value for under 800k. Needs septic and water tanks, but features outstanding soil and flat build envelopes."
  }
];

class JSONDatabase implements DatabaseInterface {
  private filePath: string;
  private data: any[] = [];

  constructor() {
    this.filePath = path.join(process.cwd(), "properties_db.json");
  }

  async init() {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      this.data = JSON.parse(content);
    } catch {
      // Initialize with seed properties
      this.data = SEED_PROPERTIES.map((p, idx) => ({ id: idx + 1, ...p, images: JSON.stringify(p.images) }));
      await this.save();
    }
  }

  private async save() {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async all(query: string, params: any[] = []): Promise<any[]> {
    if (query.toLowerCase().includes("order by id desc")) {
      return [...this.data].sort((a, b) => b.id - a.id);
    }
    return [...this.data];
  }

  async get(query: string, params: any[] = []): Promise<any | undefined> {
    if (query.toLowerCase().includes("where url = ?")) {
      const normalize = (u: string) => {
        try { const parsed = new URL(u); return parsed.origin + parsed.pathname; } catch { return u; }
      };
      const target = normalize(params[0] || "");
      return this.data.find((p) => normalize(p.url || "") === target);
    }
    const id = params[0];
    return this.data.find((p) => p.id === Number(id));
  }

  async run(query: string, params: any[] = []): Promise<{ lastID: number }> {
    const isInsert = query.toLowerCase().includes("insert into");
    const isUpdate = query.toLowerCase().includes("update properties");
    const isDelete = query.toLowerCase().includes("delete from");

    if (isInsert) {
      const nextId = this.data.length > 0 ? Math.max(...this.data.map((p) => p.id)) + 1 : 1;
      const newProp = {
        id: nextId,
        url: params[0] || "",
        address: params[1],
        price: Number(params[2]) || 0,
        landSize: Number(params[3]) || 0,
        bedrooms: Number(params[4]) || 0,
        bathrooms: Number(params[5]) || 0,
        carSpaces: Number(params[6]) || 0,
        description: params[7] || "",
        agentName: params[8] || "",
        agentAgency: params[9] || "",
        agentPhone: params[10] || "",
        images: params[11] || "[]",
        lat: params[12] != null ? Number(params[12]) : null,
        lng: params[13] != null ? Number(params[13]) : null,
        existingHouse: Number(params[14]) || 0,
        vacantLand: Number(params[15]) || 0,
        shed: Number(params[16]) || 0,
        dam: Number(params[17]) || 0,
        waterTanks: Number(params[18]) || 0,
        stables: Number(params[19]) || 0,
        horseFacilities: Number(params[20]) || 0,
        powerConnected: Number(params[21]) || 0,
        septic: Number(params[22]) || 0,
        bushfireMentions: params[23] || "",
        buildabilityMentions: params[24] || "",
        planningReferences: params[25] || "",
        nativeVegetationReferences: params[26] || "",
        commuteScore: Number(params[27]) || 0,
        commuteTimeAM: Number(params[28]) || 0,
        commuteTimePM: Number(params[29]) || 0,
        landScore: Number(params[30]) || 0,
        budgetScore: Number(params[31]) || 0,
        horseScore: Number(params[32]) || 0,
        buildabilityScore: Number(params[33]) || 0,
        overallScore: Number(params[34]) || 0,
        status: params[35] || "New",
        notes: params[36] || "",
        createdAt: new Date().toISOString()
      };
      this.data.push(newProp);
      await this.save();
      return { lastID: nextId };
    }

    if (isUpdate) {
      const id = params[params.length - 1];
      const index = this.data.findIndex((p) => p.id === Number(id));
      if (index !== -1) {
        this.data[index] = {
          ...this.data[index],
          url: params[0] || "",
          address: params[1],
          price: Number(params[2]) || 0,
          landSize: Number(params[3]) || 0,
          bedrooms: Number(params[4]) || 0,
          bathrooms: Number(params[5]) || 0,
          carSpaces: Number(params[6]) || 0,
          description: params[7] || "",
          agentName: params[8] || "",
          agentAgency: params[9] || "",
          agentPhone: params[10] || "",
          images: params[11] || "[]",
          lat: params[12] != null ? Number(params[12]) : null,
          lng: params[13] != null ? Number(params[13]) : null,
          existingHouse: Number(params[14]) || 0,
          vacantLand: Number(params[15]) || 0,
          shed: Number(params[16]) || 0,
          dam: Number(params[17]) || 0,
          waterTanks: Number(params[18]) || 0,
          stables: Number(params[19]) || 0,
          horseFacilities: Number(params[20]) || 0,
          powerConnected: Number(params[21]) || 0,
          septic: Number(params[22]) || 0,
          bushfireMentions: params[23] || "",
          buildabilityMentions: params[24] || "",
          planningReferences: params[25] || "",
          nativeVegetationReferences: params[26] || "",
          commuteScore: Number(params[27]) || 0,
          commuteTimeAM: Number(params[28]) || 0,
          commuteTimePM: Number(params[29]) || 0,
          landScore: Number(params[30]) || 0,
          budgetScore: Number(params[31]) || 0,
          horseScore: Number(params[32]) || 0,
          buildabilityScore: Number(params[33]) || 0,
          overallScore: Number(params[34]) || 0,
          status: params[35] || "New",
          notes: params[36] || ""
        };
        await this.save();
      }
      return { lastID: Number(id) };
    }

    if (isDelete) {
      if (params.length === 0) {
        this.data = [];
        await this.save();
        return { lastID: 0 };
      }
      const id = params[0];
      this.data = this.data.filter((p) => p.id !== Number(id));
      await this.save();
      return { lastID: Number(id) };
    }

    return { lastID: 0 };
  }
}

export async function getDb(): Promise<DatabaseInterface> {
  if (dbInstance) {
    return dbInstance;
  }

  // Use the ultra-robust JSONDatabase directly to completely sidestep GLIBC binary load errors in sandboxed containers.
  const jsonDb = new JSONDatabase();
  await jsonDb.init();
  dbInstance = jsonDb;

  return dbInstance;
}
