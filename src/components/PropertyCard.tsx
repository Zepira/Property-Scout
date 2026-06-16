import React from "react";
import { Property } from "../types";
import { CheckCircle2, MapPin, LandPlot, RefreshCw } from "lucide-react";

interface PropertyCardProps {
  property: Property;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PropertyCard({ property, isSelected, onSelect }: PropertyCardProps) {
  // Color code based on status
  const statusColors = {
    New: "bg-blue-950/40 text-blue-400 border-blue-900/50",
    Interested: "bg-indigo-950/40 text-indigo-400 border-indigo-900/50",
    Inspecting: "bg-teal-950/40 text-teal-400 border-teal-900/50",
    Shortlisted: "bg-amber-950/40 text-amber-400 border-amber-900/50",
    Rejected: "bg-rose-950/40 text-rose-400 border-rose-900/50",
    Purchased: "bg-emerald-950/40 text-emerald-400 border-emerald-900/50",
  }[property.status] || "bg-bg-dark text-text-dim border-border-dark";

  const fmtMins = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h > 0 ? `${h}h ${r}m` : `${r}m`; };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-success-dark bg-success-dark/20 border-success-dark/40";
    if (score >= 50) return "text-warning-dark bg-warning-dark/15 border-warning-dark/35";
    return "text-danger-dark bg-danger-dark/20 border-danger-dark/40";
  };

  const heroImage = property.images && property.images.length > 0 
    ? property.images[0] 
    : "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop";

  return (
    <div
      onClick={onSelect}
      id={`property-card-${property.id}`}
      className={`group cursor-pointer rounded-xl border border-border-dark bg-card-dark shadow-xs overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-text-dim/30 flex flex-col h-full ${
        isSelected ? "ring-2 ring-accent-dark border-accent-dark scale-[1.01]" : ""
      }`}
    >
      {/* Property Thumbnail Hero */}
      <div className="relative h-44 w-full bg-bg-dark overflow-hidden">
        <img
          src={heroImage}
          alt={property.address}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />
        
        {/* Status Chip overlay */}
        <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs ${statusColors}`}>
          {property.status}
        </span>

        {/* Score Ring / Circle overlay */}
        <div className={`absolute top-3 right-3 flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 font-bold font-sans text-sm shadow-md backdrop-blur-md ${getScoreColor(property.overallScore)}`}>
          <span className="text-[9px] -mb-1 uppercase font-semibold block text-text-dim">Score</span>
          <span className="text-sm font-extrabold">{property.overallScore}</span>
        </div>

        {/* Bottom fading overlay for readable address label */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <p className="text-white text-xs font-mono tracking-tight uppercase truncate flex items-center gap-1">
            <LandPlot className="w-3.5 h-3.5 text-accent-dark shrink-0" />
            {property.landSize.toFixed(1)} Acres • {property.bedrooms}b / {property.bathrooms}ba
          </p>
        </div>
      </div>

      {/* Card Details Body */}
      <div className="p-4 flex flex-col justify-between flex-grow">
        <div>
          <h4 className="font-semibold text-text-main leading-snug group-hover:text-accent-dark transition-colors text-sm truncate">
            {property.address}
          </h4>
          <p className="font-bold text-accent-dark text-sm mt-1">
            {property.price > 0 
              ? property.price.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }) 
              : "Contact Agent"}
          </p>

          <p className="text-xs text-text-dim mt-2 line-clamp-2 leading-relaxed">
            {property.description || "No description provided."}
          </p>
        </div>

        {/* Footer indicators */}
        <div className="mt-4 pt-3 border-t border-border-dark flex justify-between items-center text-[10px] text-text-dim font-mono uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-dark"></span>
            Commute: {fmtMins(Math.round((property.commuteTimeAM + property.commuteTimePM) / 2))}
          </div>
          {property.url ? (
            <span className="text-success-dark font-semibold flex items-center gap-0.5">
              • Saved
            </span>
          ) : (
            <span className="text-warning-dark font-semibold flex items-center gap-0.5">
              • Manual
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
