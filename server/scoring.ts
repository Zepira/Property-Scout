// Moorabbin Moorabbin coordinates
const MOORABBIN_LAT = -37.947291;
const MOORABBIN_LNG = 145.064560;

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
      return data.results[0].geometry.location;
    }
  } catch (error) {
    console.error("Geocoding failed:", error);
  }
  return null;
}

/**
 * Calculate driving commute time using Google Maps Distance Matrix API
 */
export async function fetchCommuteTimes(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ timeAM: number; timePM: number } | null> {
  if (!apiKey) return null;
  try {
    // Departure time for 12 AM (mid-night) and 1 PM (afternoon) relative to next weekday
    // 12 AM (midnight)
    const today = new Date();
    const nextWeekday = new Date(today);
    nextWeekday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7)); // Next Monday
    
    const dateAM = new Date(nextWeekday);
    dateAM.setHours(0, 0, 0, 0); // 12 AM
    const departureAM = Math.floor(dateAM.getTime() / 1000);

    const datePM = new Date(nextWeekday);
    datePM.setHours(13, 0, 0, 0); // 1 PM
    const departurePM = Math.floor(datePM.getTime() / 1000);

    const getDuration = async (depTime: number): Promise<number> => {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${MOORABBIN_LAT},${MOORABBIN_LNG}&departure_time=${depTime}&traffic_model=best_guess&mode=driving&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (
        data.status === "OK" &&
        data.rows?.[0]?.elements?.[0]?.status === "OK"
      ) {
        const element = data.rows[0].elements[0];
        // duration_in_traffic if available, else standard duration
        const durationValue = element.duration_in_traffic?.value ?? element.duration?.value;
        return Math.round(durationValue / 60); // minutes
      }
      throw new Error("Invalid Distance Matrix response");
    };

    const timeAM = await getDuration(departureAM);
    const timePM = await getDuration(departurePM);

    return { timeAM, timePM };
  } catch (error) {
    console.error("Failed to fetch commute times from Google Maps:", error);
  }
  return null;
}

/**
 * Main Scoring Calculator
 */
export function calculateScores(
  features: PropertyFeatures,
  coordinates: { lat: number; lng: number } | null
): ScoreBreakdown {
  // 1. Commute Score (35%)
  let commuteTimeAM = 45; // Default placeholder values
  let commuteTimePM = 50;

  if (coordinates) {
    // Calculate estimated driving times using Haversine distance as a fallback model
    const straightLineKm = getHaversineDistance(
      coordinates.lat,
      coordinates.lng,
      MOORABBIN_LAT,
      MOORABBIN_LNG
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
