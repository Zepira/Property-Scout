export type ProfileId = 'farm' | 'firsthome';

export interface Profile {
  id: ProfileId;
  name: string;
}

export type PropertyStatus = "New" | "Interested" | "Inspecting" | "Shortlisted" | "Rejected" | "Purchased";

export interface Property {
  id: number;
  profileId: ProfileId;
  url: string;
  address: string;
  price: number;
  landSize: number; // in acres
  bedrooms: number;
  bathrooms: number;
  carSpaces: number;
  garages?: number;       // FHB: number of garage bays
  landSqm?: number;       // FHB: land size in square metres
  isNewBuild?: boolean;   // FHB: affects FHOG eligibility
  description: string;
  agentName: string;
  agentAgency: string;
  agentPhone: string;
  images: string[];
  lat: number | null;
  lng: number | null;

  // AI Extracted features
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

  // Scores
  commuteScore: number;
  commuteTimeAM: number;
  commuteTimePM: number;
  landScore: number;
  budgetScore: number;
  horseScore: number;
  buildabilityScore: number;
  houseSizeScore: number; // FHB only; always 0 for farm profile
  overallScore: number;

  // Manual Status & Custom Notes
  status: PropertyStatus;
  notes: string;
  createdAt: string;
}

export interface UserPreferences {
  workplace: string;
  workplaceCoords: { lat: number; lng: number };
  maxCommuteMins: number;
  maxBudget: number;
  minLandAcres: number;
  idealLandAcres: number;
  preferredRegions: string[];
}
