import React, { useState } from "react";
import { Link, Clipboard, Sparkles, PlusCircle, Globe, FileText, MapPin } from "lucide-react";
import { ProfileId } from '../types';

interface PropertyFormProps {
  onSuccess: (property: any) => void;
  activeProfile: ProfileId;
}

export default function PropertyForm({ onSuccess, activeProfile }: PropertyFormProps) {
  const [activeTab, setActiveTab] = useState<"url" | "text" | "manual">("url");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tabs Inputs
  const [urlInput, setUrlInput] = useState("");
  const [pastedText, setPastedText] = useState("");

  // Manual Fields
  const [manualAddress, setManualAddress] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualLandSize, setManualLandSize] = useState("");
  const [manualBeds, setManualBeds] = useState("");
  const [manualBaths, setManualBaths] = useState("");
  const [manualCars, setManualCars] = useState("");

  // FHB-only manual fields
  const [garages, setGarages] = useState(0);
  const [landSqm, setLandSqm] = useState(0);
  const [isNewBuild, setIsNewBuild] = useState(false);

  // Farm-only manual checkboxes
  const [manualDam, setManualDam] = useState(false);
  const [manualStables, setManualStables] = useState(false);
  const [manualHorseFacilities, setManualHorseFacilities] = useState(false);
  const [manualWaterTanks, setManualWaterTanks] = useState(false);
  const [manualShed, setManualShed] = useState(false);
  const [manualPowerConnected, setManualPowerConnected] = useState(false);
  const [manualSeptic, setManualSeptic] = useState(false);
  const [manualVacantLand, setManualVacantLand] = useState(false);
  const [manualExistingHouse, setManualExistingHouse] = useState(false);

  const funnyMessages = [
    "Contacting Property Scout satellite archives...",
    "Scanning Victorian zoning maps...",
    "Evaluating Melbourne Southeast morning commute...",
    "Analyzing soil porosity for buildability...",
    "Checking horse dressage suitability indices...",
    "Analyzing planning overlays & bushfire overlays...",
    "Summoning the real estate parser AI...",
  ];

  const triggerLoader = () => {
    setLoading(true);
    setErrorHeader(null);
    setErrorMessage(null);
    let index = 0;
    setLoadingMessage(funnyMessages[0]);
    const interval = setInterval(() => {
      index = (index + 1) % funnyMessages.length;
      setLoadingMessage(funnyMessages[index]);
    }, 2800);
    return () => clearInterval(interval);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    const stopMessage = triggerLoader();
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Save the property to database
      const saveResponse = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const savedData = await saveResponse.json();
      setUrlInput("");
      onSuccess(savedData);
    } catch (err: any) {
      console.error(err);
      const isQuota = err.message?.includes("429") || err.message?.includes("Quota") || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("rate limit");
      if (isQuota) {
        setErrorHeader("Gemini API Rate Limit Exceeded");
        setErrorMessage(
          "The Gemini API shared key has hit its quota limit. If you have already added your custom 'GEMINI_API_KEY' in the secrets panel, please click 'Restart Dev Server' so it is activated. Since mock details are not useful, you can copy the web listing description text and use the 'Paste Text' tab, or create the parcel instantly in 'Add Manual'."
        );
      } else {
        setErrorHeader("Error Importing URL");
        setErrorMessage(err.message || "An unexpected error occurred while parsing the listing.");
      }
    } finally {
      clearInterval(stopMessage as any);
      setLoading(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText) return;

    const stopMessage = triggerLoader();
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptionText: pastedText }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Save property to db
      const saveResponse = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const savedData = await saveResponse.json();
      setPastedText("");
      onSuccess(savedData);
    } catch (err: any) {
      console.error(err);
      const isQuota = err.message?.includes("429") || err.message?.includes("Quota") || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("rate limit");
      if (isQuota) {
        setErrorHeader("Gemini API Rate Limit Exceeded");
        setErrorMessage(
          "The Gemini API has hit its quota limit (429). Since mock details are not useful, we recommend entering key attributes directly using the 'Add Manual' tab below so you can proceed without waiting for the rate limit to clear."
        );
      } else {
        setErrorHeader("Error Parsing Text Description");
        setErrorMessage(err.message || "Could not analyze text description.");
      }
    } finally {
      clearInterval(stopMessage as any);
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorHeader(null);
    setErrorMessage(null);

    if (!manualAddress || !manualPrice || !manualLandSize) {
      setErrorHeader("Missing Fields");
      setErrorMessage("Address, Purchase Price, and Land Size are required to create a property record.");
      return;
    }

    const stopMessage = triggerLoader();
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile,
          address: manualAddress,
          price: Number(manualPrice),
          landSize: Number(manualLandSize),
          bedrooms: Number(manualBeds) || 0,
          bathrooms: Number(manualBaths) || 0,
          carSpaces: Number(manualCars) || 0,
          garages,
          landSqm,
          isNewBuild,
          dam: manualDam,
          stables: manualStables,
          horseFacilities: manualHorseFacilities,
          waterTanks: manualWaterTanks,
          shed: manualShed,
          powerConnected: manualPowerConnected,
          septic: manualSeptic,
          vacantLand: manualVacantLand,
          existingHouse: manualExistingHouse,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const saveResponse = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const savedData = await saveResponse.json();

      setManualAddress("");
      setManualPrice("");
      setManualLandSize("");
      setManualBeds("");
      setManualBaths("");
      setManualCars("");
      setGarages(0);
      setLandSqm(0);
      setIsNewBuild(false);
      setManualDam(false);
      setManualStables(false);
      setManualHorseFacilities(false);
      setManualWaterTanks(false);
      setManualShed(false);
      setManualPowerConnected(false);
      setManualSeptic(false);
      setManualVacantLand(false);
      setManualExistingHouse(false);
      onSuccess(savedData);
    } catch (err: any) {
      console.error(err);
      setErrorHeader("Error Creating Record");
      setErrorMessage(err.message || "Failed to create manual property record.");
    } finally {
      clearInterval(stopMessage as any);
      setLoading(false);
    }
  };

  return (
    <div className="bg-card-dark border border-border-dark text-text-main rounded-xl shadow-lg p-5 relative animate-fade-in">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-bg-dark/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="relative flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-dark"></div>
            <Sparkles className="absolute w-5 h-5 text-accent-dark animate-pulse" />
          </div>
          <p className="font-semibold text-text-main text-sm">{loadingMessage}</p>
          <p className="text-[10px] text-text-dim uppercase mt-2 font-mono">Hold tight, evaluation takes ~10-15 seconds</p>
        </div>
      )}

      <h3 className="font-bold text-sm tracking-wide flex items-center gap-2 uppercase text-text-main">
        <PlusCircle className="w-5 h-5 text-accent-dark shrink-0" />
        Analyze Property Scout Listing
      </h3>
      <p className="text-xs text-text-dim mt-1 mb-4 leading-relaxed">
        Let Property Scout's built-in evaluation pipeline scan acreage listings, approximate Moorabbin commutes, assess horse eligibility, buying stamp duty and compute custom scores.
      </p>

      {/* Mode selectors */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-bg-dark border border-border-dark rounded-lg mb-4">
        <button
          onClick={() => setActiveTab("url")}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "url" ? "bg-accent-dark text-bg-dark shadow-sm font-bold" : "text-text-dim hover:text-text-main"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Import URL
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "text" ? "bg-accent-dark text-bg-dark shadow-sm font-bold" : "text-text-dim hover:text-text-main"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Paste Text
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "manual" ? "bg-accent-dark text-bg-dark shadow-sm font-bold" : "text-text-dim hover:text-text-main"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Add Manual
        </button>
      </div>

      {/* Error Notice */}
      {errorHeader && (
        <div className="mb-4 p-3.5 bg-red-950/40 border border-red-800/40 rounded-lg text-xs leading-relaxed text-red-200 animate-fade-in space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-red-400 text-sm">
            <span>⚠️</span> {errorHeader}
          </div>
          <p className="text-[11px] text-red-300 font-medium">{errorMessage}</p>
          <div className="pt-1 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab("manual");
                setErrorHeader(null);
                setErrorMessage(null);
              }}
              className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800/80 border border-red-700/40 text-red-100 rounded text-[10px] font-bold uppercase transition"
            >
              Fill details manually
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("text");
                setErrorHeader(null);
                setErrorMessage(null);
              }}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded text-[10px] font-bold uppercase transition"
            >
              Paste description text
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorHeader(null);
                setErrorMessage(null);
              }}
              className="px-2.5 py-1 bg-transparent hover:bg-neutral-800/40 text-neutral-400 hover:text-neutral-200 rounded text-[10px] font-bold uppercase transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tab: URL Loader */}
      {activeTab === "url" && (
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
              Listing URL (Domain or Realestate.com.au)
            </label>
            <input
              type="url"
              required
              id="import-url-input"
              placeholder="e.g. https://www.domain.com.au/property-address-emerald-vic..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark font-sans text-text-main shadow-inner"
            />
          </div>
          <button
            type="submit"
            id="import-url-submit-btn"
            className="w-full py-2 px-4 rounded-lg bg-accent-dark hover:brightness-110 font-bold text-xs text-bg-dark uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Analyze & Save Page
          </button>
        </form>
      )}

      {/* Tab: Paste Text */}
      {activeTab === "text" && (
        <form onSubmit={handleTextSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
              Paste Copy-Paste Listing Description
            </label>
            <textarea
              required
              rows={5}
              placeholder="Paste entire text of advertisement here... AI will map property address, price, land size, bedrooms, bath, shed, power, septic etc."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark font-sans text-text-main shadow-inner resize-none mb-1"
            />
          </div>
          <button
            type="submit"
            id="process-text-submit-btn"
            className="w-full py-2 px-4 rounded-lg bg-accent-dark hover:brightness-110 font-bold text-xs text-bg-dark uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Parse with Property AI
          </button>
        </form>
      )}

      {/* Tab: Add Manual */}
      {activeTab === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
                Property Address
              </label>
              <input
                type="text"
                required
                id="manual-address-input"
                placeholder="e.g. 50 Emerald-Monbulk Rd, Emerald VIC 3782"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
                Purchase Price ($ AUD)
              </label>
              <input
                type="number"
                required
                id="manual-price-input"
                placeholder="e.g. 850000"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
                Land Size ({activeProfile === 'firsthome' ? 'm²' : 'acres'})
              </label>
              <input
                type="number"
                step="any"
                required
                id="manual-acres-input"
                placeholder="e.g. 4.5"
                value={manualLandSize}
                onChange={(e) => setManualLandSize(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
                Bedrooms / Bath
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  placeholder="Beds"
                  value={manualBeds}
                  onChange={(e) => setManualBeds(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main text-center"
                />
                <input
                  type="number"
                  placeholder="Baths"
                  value={manualBaths}
                  onChange={(e) => setManualBaths(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main text-center"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider block mb-1">
                Car Spaces
              </label>
              <input
                type="number"
                placeholder="e.g. 3"
                value={manualCars}
                onChange={(e) => setManualCars(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-bg-dark border border-border-dark rounded-lg focus:outline-hidden focus:border-accent-dark text-text-main text-center"
              />
            </div>
          </div>

          {/* Farm-only fields */}
          {activeProfile === 'farm' && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Farm Features</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {(
                  [
                    ['manualDam', 'Dam', manualDam, setManualDam],
                    ['manualStables', 'Stables', manualStables, setManualStables],
                    ['manualHorseFacilities', 'Horse Facilities', manualHorseFacilities, setManualHorseFacilities],
                    ['manualWaterTanks', 'Water Tanks', manualWaterTanks, setManualWaterTanks],
                    ['manualShed', 'Shed', manualShed, setManualShed],
                    ['manualPowerConnected', 'Power Connected', manualPowerConnected, setManualPowerConnected],
                    ['manualSeptic', 'Septic', manualSeptic, setManualSeptic],
                    ['manualVacantLand', 'Vacant Land', manualVacantLand, setManualVacantLand],
                    ['manualExistingHouse', 'Existing House', manualExistingHouse, setManualExistingHouse],
                  ] as [string, string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]
                ).map(([key, label, value, setter]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={e => setter(e.target.checked)}
                      className="w-4 h-4 accent-accent-dark"
                    />
                    <span className="text-xs text-text-dim">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* FHB-only fields */}
          {activeProfile === 'firsthome' && (
            <div className="space-y-3 pt-1">
              <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider">First Home Buyer Details</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-text-dim block">
                  Garages
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={garages}
                    onChange={e => setGarages(Number(e.target.value))}
                    className="mt-1 w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-dark"
                  />
                </label>
                <label className="text-xs text-text-dim block">
                  Land size (m²)
                  <input
                    type="number"
                    min={0}
                    value={landSqm}
                    onChange={e => setLandSqm(Number(e.target.value))}
                    className="mt-1 w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent-dark"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNewBuild}
                  onChange={e => setIsNewBuild(e.target.checked)}
                  className="w-4 h-4 accent-accent-dark"
                />
                New build <span className="text-xs text-text-dim">(affects $10k FHOG eligibility)</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            id="manual-submit-btn"
            className="w-full py-2 px-4 rounded-lg bg-accent-dark hover:brightness-110 font-bold text-xs text-bg-dark uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
          >
            Create Property Record
          </button>
        </form>
      )}
    </div>
  );
}
