import React, { useState, useEffect } from "react";
import { Property, PropertyStatus } from "../types";
import PropertyMap from "./PropertyMap";
import FinancialCalculator from "./FinancialCalculator";
import { 
  Building2, Trees, CircleGauge, Landmark, Briefcase, ExternalLink, 
  Trash2, ShieldCheck, Check, AlertOctagon, Sparkles, Clipboard, 
  MapPin, PhoneCall, Save, MessageSquareText
} from "lucide-react";

interface PropertyDetailProps {
  property: Property;
  onUpdate: (updated: Property) => void;
  onDelete: (id: number) => void;
  activeProfile?: import('../types').ProfileId;
}

export default function PropertyDetail({ property, onUpdate, onDelete }: PropertyDetailProps) {
  const [activeNotes, setActiveNotes] = useState(property.notes || "");
  const [status, setStatus] = useState<PropertyStatus>(property.status);
  const [savingNotes, setSavingNotes] = useState(false);

  // Sync state with incoming property change
  useEffect(() => {
    setActiveNotes(property.notes || "");
    setStatus(property.status);
  }, [property]);

  const handleStatusChange = async (newStatus: PropertyStatus) => {
    setStatus(newStatus);
    try {
      const updatedProp = { ...property, status: newStatus };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProp),
      });
      const data = await res.json();
      onUpdate(data);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const updatedProp = { ...property, notes: activeNotes };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProp),
      });
      const data = await res.json();
      onUpdate(data);
    } catch (err) {
      console.error("Failed to save notes", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const fmtMins = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h > 0 ? `${h}h ${r}m` : `${r}m`; };

  const getScoreBg = (score: number) => {
    if (score >= 75) return "bg-success-dark/10 text-success-dark border-success-dark/30";
    if (score >= 50) return "bg-warning-dark/10 text-warning-dark border-warning-dark/35";
    return "bg-danger-dark/10 text-danger-dark border-danger-dark/30";
  };

  const heroImage = property.images && property.images.length > 0 
    ? property.images[0] 
    : "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop";

  return (
    <div className="bg-card-dark border border-border-dark rounded-xl shadow-lg overflow-hidden id-detail" id={`property-detail-${property.id}`}>
      {/* Detail Hero Image Header */}
      <div className="relative h-72 md:h-96 w-full bg-bg-dark">
        <img
          src={heroImage}
          alt={property.address}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/30 to-bg-dark/40 flex flex-col justify-between p-6">
          {/* Action Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="bg-bg-dark/90 backdrop-blur-md text-text-main px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-border-dark uppercase">
                {property.status}
              </span>
            </div>
            
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this property?")) {
                  onDelete(property.id);
                }
              }}
              id={`delete-prop-btn-${property.id}`}
              className="p-2 bg-danger-dark hover:bg-rose-600 text-bg-dark rounded-lg shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Delete Property"
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Title & Address */}
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-text-main tracking-tight drop-shadow-md">
              {property.address}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-text-dim text-xs font-mono tracking-tight uppercase">
              <span className="font-semibold text-accent-dark">{property.landSize.toFixed(1)} Acres</span>
              <span>•</span>
              <span>{property.bedrooms} Bed</span>
              <span>•</span>
              <span>{property.bathrooms} Bath</span>
              <span>•</span>
              <span>{property.carSpaces} Car Space</span>
              {property.url && (
                <>
                  <span>•</span>
                  <a 
                    href={property.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-accent-dark hover:brightness-110 underline decoration-accent-dark inline-flex items-center gap-0.5"
                  >
                    Original Listing <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main View Grid Column */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Content - Column span 7 */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Status and Custom Decision Notes */}
          <div className="bg-bg-dark border border-border-dark rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-xs text-text-dim uppercase tracking-wider">
              Acquisition Status & Decision Notes
            </h3>
            
            {/* Status Selector Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card-dark p-3 rounded-lg border border-border-dark shadow-sm">
              <span className="text-xs font-semibold text-text-main">Current Interest Pipeline:</span>
              <select
                id={`status-select-${property.id}`}
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as PropertyStatus)}
                className="text-xs font-semibold py-1.5 px-3 bg-bg-dark border border-border-dark rounded-md focus:outline-none focus:border-accent-dark text-text-main font-sans cursor-pointer"
              >
                <option value="New">New</option>
                <option value="Interested">Interested</option>
                <option value="Inspecting">Inspecting</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Rejected">Rejected</option>
                <option value="Purchased">Purchased</option>
              </select>
            </div>

            {/* Custom Notes text area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-dim flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-accent-dark" />
                Evaluator Decision Notes
              </label>
              <textarea
                rows={3}
                id={`notes-textarea-${property.id}`}
                placeholder="Write custom feedback. E.g., 'Good horse potential but power septic needs hookup. Partner likes rural quietness.'"
                value={activeNotes}
                onChange={(e) => setActiveNotes(e.target.value)}
                className="w-full text-xs p-3 border border-border-dark rounded-lg bg-card-dark text-text-main placeholder-text-dim/40 focus:outline-none focus:border-accent-dark font-sans resize-none shadow-md"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNotes}
                  id={`save-notes-btn-${property.id}`}
                  disabled={savingNotes}
                  className="py-1.5 px-3.5 text-xs font-bold bg-accent-dark border border-accent-dark rounded-lg hover:bg-sky-400 text-bg-dark shadow-md transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 animate-pulse" />
                  {savingNotes ? "Saving Notes..." : "Save Notes"}
                </button>
              </div>
            </div>
          </div>

          {/* Score Breakdown Panel */}
          <div>
            <h3 className="font-bold text-xs text-text-dim uppercase tracking-wider mb-3">
              Performance Scorecards (Weighted)
            </h3>
            
            {/* Bento score cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { title: "Commute", score: property.commuteScore, display: fmtMins(Math.round((property.commuteTimeAM + property.commuteTimePM) / 2)), desc: "avg commute", weight: "35%" },
                { title: "Acreage", score: property.landScore, display: null, desc: `${property.landSize.toFixed(1)} ac`, weight: "25%" },
                { title: "Affordability", score: property.budgetScore, display: null, desc: `$${(property.price/1000).toFixed(0)}k`, weight: "20%" },
                { title: "Horses", score: property.horseScore, display: null, desc: "Equine suitability", weight: "10%" },
                { title: "Buildability", score: property.buildabilityScore, display: null, desc: "Infrastructure", weight: "10%" },
              ].map((card) => (
                <div key={card.title} className={`p-3 border rounded-xl flex flex-col justify-between items-center text-center transition-all hover:scale-[1.03] ${getScoreBg(card.score)}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-main">{card.title}</p>
                  <div className="my-2 text-2xl font-black font-sans leading-none">{card.display ?? card.score}</div>
                  <div>
                    <p className="text-[10px] text-text-dim font-medium truncate max-w-[80px]">{card.desc}</p>
                    <span className="text-[8px] bg-bg-dark/50 text-text-dim px-1 rounded block mt-1 font-mono">{card.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Infrastructure Feature Grid */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-text-dim uppercase tracking-wider">
              Acreage Infrastructure Checklist
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { label: "Existing House", val: property.existingHouse },
                { label: "Vacant Land Only", val: property.vacantLand },
                { label: "Shed / Workshop", val: property.shed },
                { label: "Water Dam", val: property.dam },
                { label: "Water Storage Tanks", val: property.waterTanks },
                { label: "Stables", val: property.stables },
                { label: "Horse Arenas/Fences", val: property.horseFacilities },
                { label: "Mains Power Connected", val: property.powerConnected },
                { label: "Septic System", val: property.septic },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className={`p-2.5 border rounded-lg flex items-center justify-between shadow-2xs transition-all duration-150 ${
                    item.val 
                      ? "bg-success-dark/10 border-success-dark/30 text-text-main"
                      : "bg-bg-dark/40 border-border-dark/50 text-text-dim/60"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.val ? (
                    <span className="text-success-dark bg-success-dark/20 p-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-text-dim/30">•</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Extracted Risk & Planning Insights */}
          <div className="bg-bg-dark border border-border-dark rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-xs text-accent-dark uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 shrink-0" />
              AI Property Scout Extraction Insights
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans leading-relaxed">
              <div className="space-y-1 bg-card-dark p-3 rounded-lg border border-border-dark">
                <p className="font-bold text-accent-dark text-[10px] uppercase font-mono tracking-wider">Bushfire Management Mention</p>
                <p className="text-text-main">{property.bushfireMentions || "No explicit bushfire mentions detected."}</p>
              </div>

              <div className="space-y-1 bg-card-dark p-3 rounded-lg border border-border-dark">
                <p className="font-bold text-accent-dark text-[10px] uppercase font-mono tracking-wider">Buildability & Envelopes</p>
                <p className="text-text-main">{property.buildabilityMentions || "No mentions."}</p>
              </div>

              <div className="space-y-1 bg-card-dark p-3 rounded-lg border border-border-dark">
                <p className="font-bold text-accent-dark text-[10px] uppercase font-mono tracking-wider">Zoning & Planning overlay</p>
                <p className="text-text-main">{property.planningReferences || "None."}</p>
              </div>

              <div className="space-y-1 bg-card-dark p-3 rounded-lg border border-border-dark">
                <p className="font-bold text-accent-dark text-[10px] uppercase font-mono tracking-wider">Native Clearance Overlay</p>
                <p className="text-text-main">{property.nativeVegetationReferences || "None detected."}</p>
              </div>
            </div>
          </div>

          {/* Full Ad Listing text */}
          <div className="border border-border-dark rounded-xl p-5 bg-bg-dark">
            <h3 className="font-bold text-xs text-text-dim uppercase tracking-wider mb-2">Original Listing Description</h3>
            <p className="text-xs text-text-main font-sans leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto pr-2">
              {property.description}
            </p>
          </div>
        </div>

        {/* Right Side Map & Financials - Column span 5 */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Map Viewer */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-text-dim uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-accent-dark" />
              Property Map Location
            </h3>
            <PropertyMap property={property} />
          </div>

          {/* Commute parameters */}
          <div className="bg-bg-dark border border-border-dark rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-text-dim uppercase tracking-wider">
              Workplace driving commute
            </h4>
            <div className="text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-dim">Departure 12:00 AM (Ideal):</span>
                <span className="font-bold text-text-main">{fmtMins(property.commuteTimeAM)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">Departure 1:00 PM (Lighter traffic):</span>
                <span className="font-bold text-text-main">{fmtMins(property.commuteTimePM)}</span>
              </div>
              <div className="border-t border-border-dark pt-2 flex justify-between font-bold text-text-main">
                <span className="text-text-dim font-sans">Acreage Commute Score:</span>
                <span className="text-accent-dark font-sans">{property.commuteScore} / 100</span>
              </div>
            </div>
          </div>

          {/* Financial Buying Calculator */}
          <FinancialCalculator price={property.price} />

          {/* Agent Information */}
          <div className="bg-bg-dark border border-border-dark rounded-xl p-4">
            <h4 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-3">
              Listing Broker / Agent Details
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-main">{property.agentName || "Agent not extracted"}</span>
                {property.agentAgency && (
                  <span className="text-[10px] bg-card-dark text-accent-dark px-1.5 py-0.5 rounded-full border border-border-dark font-mono font-bold">
                    {property.agentAgency}
                  </span>
                )}
              </div>
              {property.agentPhone && (
                <div className="flex items-center gap-1.5 text-accent-dark font-semibold font-mono hover:underline">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <a href={`tel:${property.agentPhone}`}>{property.agentPhone}</a>
                </div>
              )}
            </div>
          </div>

          {/* Nearby Amenities panel */}
          <div className="bg-accent-dark/5 border border-accent-dark/20 rounded-xl p-4 space-y-2 text-xs">
            <h4 className="font-bold text-accent-dark uppercase tracking-wider text-[11px]">Victoria Regional Landmarks</h4>
            <p className="text-text-dim leading-relaxed">
              Based on the detected postcode and coordinates, this property sits near the regional hubs of Victoria, close to national parks, schools, arterial transport pathways, and grocery stores.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
