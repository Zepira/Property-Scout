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

export interface PropertyFeatures {
  landSize: number; // In acres
  price: number;
  existingHouse: boolean;
  vacantLand: boolean;
  shed: boolean;
  dam: boolean;
  waterTanks: boolean;
  stables: boolean;
  horseFacilities: boolean;
  powerConnected: boolean;
  septic: boolean;
}

export interface ScoreBreakdown {
  commuteScore: number;
  commuteTimeAM: number; // minutes
  commuteTimePM: number; // minutes
  landScore: number;
  budgetScore: number;
  horseScore: number;
  buildabilityScore: number;
  overallScore: number;
}

// Haversine formula for straight-line distance
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Geocode address to get coordinates using Google Geocoding API if key is present
 */
export async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      console.log(`Geocoded "${address}" → lat=${loc.lat} lng=${loc.lng}`);
      return loc;
    }
    console.warn(`Geocoding failed for "${address}": status=${data.status} error=${data.error_message || ""}`);
  } catch (error) {
    console.error("Geocoding exception:", error);
  }
  return null;
}

/**
 * Calculate driving commute time using Google Maps Distance Matrix API
 */
export async function fetchCommuteTimes(
  lat: number,
  lng: number,
  apiKey: string,
  destLat: number = MOORABBIN_LAT,
  destLng: number = MOORABBIN_LNG,
): Promise<{ timeAM: number; timePM: number } | null> {
  if (!apiKey) return null;

  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

  const makeDepTime = (hour: number, minute: number) => {
    const d = new Date(nextMonday);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const routesDuration = async (departureIso: string): Promise<number> => {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: lat, longitude: lng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        departureTime: departureIso,
      }),
    });
    const data = (await res.json()) as any;
    if (!res.ok || !data.routes?.[0]?.duration) {
      console.error("Routes API error:", JSON.stringify(data).substring(0, 300));
      throw new Error(`Routes API failed: ${data.error?.message || res.status}`);
    }
    // duration is like "3720s"
    return Math.round(parseInt(data.routes[0].duration) / 60);
  };

  try {
    const [timeAM, timePM] = await Promise.all([
      routesDuration(makeDepTime(8, 0)),
      routesDuration(makeDepTime(17, 30)),
    ]);
    console.log(`Commute via Routes API: AM=${timeAM}min PM=${timePM}min`);
    return { timeAM, timePM };
  } catch (err) {
    console.warn("Routes API failed, using Haversine estimate:", err);
    return null;
  }
}

/**
 * Main Scoring Calculator
 */
export function calculateScores(
  features: PropertyFeatures,
  coordinates: { lat: number; lng: number } | null,
  destLat: number = MOORABBIN_LAT,
  destLng: number = MOORABBIN_LNG,
): ScoreBreakdown {
  // 1. Commute Score (35%)
  let commuteTimeAM = 45; // Default placeholder values
  let commuteTimePM = 50;

  if (coordinates) {
    // Calculate estimated driving times using Haversine distance as a fallback model
    const straightLineKm = getHaversineDistance(
      coordinates.lat,
      coordinates.lng,
      destLat,
      destLng
    );
    // Estimated driving road factor (approx 1.25x straight line)
    const roadKm = straightLineKm * 1.25;

    // AM: Midnight 12 AM (ideal traffic: ~72 km/h avg)
    commuteTimeAM = Math.max(1, Math.round((roadKm / 72) * 60));
    // PM: 1 PM (moderate traffic: ~55 km/h avg)
    commuteTimePM = Math.max(1, Math.round((roadKm / 55) * 60));
  }

  // Scoring travel times
  const avgCommuteTime = (commuteTimeAM + commuteTimePM) / 2;
  let commuteScore = 0;
  if (avgCommuteTime <= 40) commuteScore = 100;
  else if (avgCommuteTime <= 60) commuteScore = 75;
  else if (avgCommuteTime <= 75) commuteScore = 50;
  else if (avgCommuteTime <= 90) commuteScore = 25;
  else commuteScore = 0;

  // 2. Land Score (25%)
  // Minimum 2 acres. Increases scaling up to 20 acres capped.
  let landScore = 0;
  if (features.landSize >= 2) {
    // Capped at 20
    const size = Math.min(20, features.landSize);
    // Linear scale between 2.0 (50 points) and 20.0 (100 points)
    landScore = Math.round(50 + ((size - 2) * (100 - 50)) / (20 - 2));
  } else {
    // Below 2 acres, gets substantial penalty or 0
    landScore = Math.round((features.landSize / 2) * 30); // Max 30 points if under 2 acres
  }

  // 3. Budget Score (20%)
  // Max price $1,000,000. Under 800k = 100 points.
  let budgetScore = 0;
  if (features.price <= 800000) {
    budgetScore = 100;
  } else if (features.price > 1000000) {
    budgetScore = 0;
  } else {
    // Linear scale between 800k (100 points) and 1,000,000 (50 points)
    budgetScore = Math.round(100 - ((features.price - 800000) * (100 - 50)) / 200000);
  }

  // 4. Horse Suitability Score (10%)
  // Based on acreage, cleared land, dam, fencing, stables
  let horseScore = 0;
  // Size contribution (max 40 points)
  if (features.landSize >= 5) horseScore += 40;
  else if (features.landSize >= 3) horseScore += 30;
  else if (features.landSize >= 2) horseScore += 20;

  // Features contributions
  if (features.dam) horseScore += 15;
  if (features.stables || features.horseFacilities) horseScore += 15;
  // Assume cleared land / good fencing if we parse description with horse facilities
  if (features.horseFacilities) horseScore += 15;
  if (features.shed) horseScore += 15;

  // Overall capped at 100
  horseScore = Math.min(100, horseScore);

  // 5. Buildability Score (10%)
  // Based on existing house, power, water, septic, planning references
  let buildabilityScore = 0;
  if (features.existingHouse) {
    // Already has a house - minimal build worries!
    buildabilityScore = 100;
  } else {
    // Vacant land style buildability
    if (features.powerConnected) buildabilityScore += 30;
    if (features.septic) buildabilityScore += 30;
    if (features.waterTanks) buildabilityScore += 20;
    if (features.shed) buildabilityScore += 20;
    buildabilityScore = Math.min(100, buildabilityScore);
    if (buildabilityScore === 0) buildabilityScore = 20; // Default base value for empty fields
  }

  // 6. Overall Weighted Score
  // 35% commute, 25% land size, 20% budget, 10% horse, 10% buildability
  const overallScore = Math.round(
    commuteScore * 0.35 +
      landScore * 0.25 +
      budgetScore * 0.20 +
      horseScore * 0.10 +
      buildabilityScore * 0.10
  );

  return {
    commuteScore,
    commuteTimeAM,
    commuteTimePM,
    landScore,
    budgetScore,
    horseScore,
    buildabilityScore,
    overallScore,
  };
}

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
