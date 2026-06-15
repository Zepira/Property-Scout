import React, { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { Property } from "../types";

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "AIzaSyBRCXm3cMSGUX4GhtK-VbP0RfNfMqQeQ8o";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && API_KEY.trim() !== "";

const MOORABBIN = { lat: -37.947291, lng: 145.064560 };

interface PropertyMapProps {
  property: Property;
}

export default function PropertyMap({ property }: PropertyMapProps) {
  const propertyCoords = property.lat && property.lng ? { lat: property.lat, lng: property.lng } : null;
  const [openMarker, setOpenMarker] = useState<"property" | "workplace" | null>(null);

  const [propMarkerRef, propMarker] = useAdvancedMarkerRef();
  const [workMarkerRef, workMarker] = useAdvancedMarkerRef();

  if (!hasValidKey) {
    return (
      <div className="bg-bg-dark border border-border-dark rounded-xl p-6 flex flex-col items-center justify-center text-center h-[350px] animate-fade-in">
        <div className="p-3 bg-accent-dark/15 text-accent-dark rounded-full mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h4 className="font-semibold text-text-main mb-1">Google Maps API Key Missing</h4>
        <p className="text-xs text-text-dim max-w-sm mb-4">
          To enable live 3D Google Maps & routing calculations, add your Google Maps key in the system secrets.
        </p>
        <div className="text-left text-xs bg-card-dark p-3 rounded-lg border border-border-dark shadow-md space-y-1.5 font-mono max-w-sm text-text-dim">
          <p className="text-[10px] text-accent-dark uppercase font-semibold">API Key Steps:</p>
          <p>1. Open Settings (⚙️ top right)</p>
          <p>2. Go to Secrets tab</p>
          <p>3. Name: <code className="bg-bg-dark border border-border-dark text-accent-dark px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">GOOGLE_MAPS_PLATFORM_KEY</code></p>
          <p>4. Save & Enter your real GMP API Key</p>
        </div>
        {/* Simple Fallback Card Layout for coordinate distances */}
        {propertyCoords && (
          <div className="mt-4 pt-3 border-t border-border-dark/60 w-full text-xs text-text-dim font-mono">
            Direct distance: {((getDistance(propertyCoords.lat, propertyCoords.lng, MOORABBIN.lat, MOORABBIN.lng)).toFixed(1))} km to Moorabbin VIC
          </div>
        )}
      </div>
    );
  }

  const center = propertyCoords || MOORABBIN;

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-md border border-border-dark relative animate-fade-in">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId="PROPERTY_SCOUT_MAP"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
          className="w-full h-full"
        >
          {propertyCoords && (
            <AdvancedMarker
              ref={propMarkerRef}
              position={propertyCoords}
              onClick={() => setOpenMarker("property")}
            >
              <Pin background="#ea4335" glyphColor="#fff" />
            </AdvancedMarker>
          )}

          <AdvancedMarker
            ref={workMarkerRef}
            position={MOORABBIN}
            onClick={() => setOpenMarker("workplace")}
          >
            <Pin background="#4285f4" glyphColor="#fff" glyphText="💼" />
          </AdvancedMarker>

          {openMarker === "property" && propertyCoords && (
            <InfoWindow anchor={propMarker} onCloseClick={() => setOpenMarker(null)}>
              <div className="p-1 font-sans text-xs">
                <p className="font-semibold text-slate-900">Property</p>
                <p className="text-slate-600 mt-0.5">{property.address}</p>
                <p className="text-indigo-600 font-semibold mt-1">${property.price.toLocaleString()}</p>
              </div>
            </InfoWindow>
          )}

          {openMarker === "workplace" && (
            <InfoWindow anchor={workMarker} onCloseClick={() => setOpenMarker(null)}>
              <div className="p-1 font-sans text-xs">
                <p className="font-semibold text-slate-900">QLM Labelmakers</p>
                <p className="text-slate-600">12 Elna Court, Moorabbin VIC</p>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
      <div className="absolute bottom-4 left-4 bg-card-dark/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border-dark text-[11px] font-mono font-medium z-10 flex flex-col gap-1 text-text-main">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
          <span>Property Position</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
          <span>QLM Workspace (Moorabbin)</span>
        </div>
      </div>
    </div>
  );
}

// Haversine distance calculator inside React
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
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
