import React, { useState, Component, ReactNode } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { Property } from "../types";

class MapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && API_KEY.trim() !== "";

const MOORABBIN = { lat: -37.947291, lng: 145.064560 };

interface PropertyMapProps {
  property: Property;
}

function PropertyPin({ color, label }: { color: string; label?: string }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50% 50% 50% 0",
        background: color, transform: "rotate(-45deg)",
        border: "2px solid rgba(0,0,0,0.25)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ transform: "rotate(45deg)", fontSize: 14 }}>{label ?? "📍"}</span>
      </div>
    </div>
  );
}

export default function PropertyMap({ property }: PropertyMapProps) {
  const propertyCoords = property.lat && property.lng ? { lat: property.lat, lng: property.lng } : null;
  const [openMarker, setOpenMarker] = useState<"property" | "workplace" | null>(null);
  const [propMarkerRef, propMarker] = useAdvancedMarkerRef();
  const [workMarkerRef, workMarker] = useAdvancedMarkerRef();

  if (!hasValidKey) {
    return (
      <div className="bg-bg-dark border border-border-dark rounded-xl p-6 flex flex-col items-center justify-center text-center h-[350px] animate-fade-in">
        <h4 className="font-semibold text-text-main mb-1">Google Maps API Key Missing</h4>
        <p className="text-xs text-text-dim max-w-sm">Add GOOGLE_MAPS_PLATFORM_KEY to your .env.local to enable the map.</p>
        {propertyCoords && (
          <div className="mt-4 text-xs text-text-dim font-mono">
            Straight-line distance: {getDistance(propertyCoords.lat, propertyCoords.lng, MOORABBIN.lat, MOORABBIN.lng).toFixed(1)} km to Moorabbin
          </div>
        )}
      </div>
    );
  }

  const center = propertyCoords || MOORABBIN;

  return (
    <MapErrorBoundary fallback={
      <div className="w-full h-[400px] rounded-xl border border-border-dark bg-bg-dark flex items-center justify-center text-center p-6">
        <div>
          <p className="font-semibold text-text-main mb-1">Map failed to load</p>
          <p className="text-xs text-text-dim">Enable the <strong>Maps JavaScript API</strong> in Google Cloud Console, then reload.</p>
          {propertyCoords && <p className="text-xs text-text-dim font-mono mt-2">{property.address}</p>}
        </div>
      </div>
    }>
    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-md border border-border-dark relative animate-fade-in">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId="DEMO_MAP_ID"
          style={{ width: "100%", height: "100%" }}
        >
          {propertyCoords && (
            <AdvancedMarker
              ref={propMarkerRef}
              position={propertyCoords}
              onClick={() => setOpenMarker(prev => prev === "property" ? null : "property")}
            >
              <PropertyPin color="#ef4444" label="🏡" />
            </AdvancedMarker>
          )}

          <AdvancedMarker
            ref={workMarkerRef}
            position={MOORABBIN}
            onClick={() => setOpenMarker(prev => prev === "workplace" ? null : "workplace")}
          >
            <PropertyPin color="#3b82f6" label="💼" />
          </AdvancedMarker>

          {openMarker === "property" && propertyCoords && propMarker && (
            <InfoWindow anchor={propMarker} onCloseClick={() => setOpenMarker(null)}>
              <div className="p-1 font-sans text-xs">
                <p className="font-semibold text-slate-900">{property.address}</p>
                <p className="text-indigo-600 font-semibold mt-1">${property.price.toLocaleString()}</p>
              </div>
            </InfoWindow>
          )}

          {openMarker === "workplace" && workMarker && (
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
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span>Property</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          <span>QLM Workspace (Moorabbin)</span>
        </div>
      </div>
    </div>
    </MapErrorBoundary>
  );
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
