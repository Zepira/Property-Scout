import React, { useState, useEffect } from "react";
import { Property, PropertyStatus } from "./types";
import PropertyCard from "./components/PropertyCard";
import PropertyDetail from "./components/PropertyDetail";
import PropertyForm from "./components/PropertyForm";
import ComparisonView from "./components/ComparisonView";
import { 
  Building2, LandPlot, Moon, CircleAlert, Compass, Search, 
  ChevronsUpDown, Filter, Scale, Plus, RefreshCw, X, ArrowUpRight 
} from "lucide-react";

export default function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | "All">("All");
  const [sortBy, setSortBy] = useState<"score" | "price_asc" | "price_desc" | "acres">("score");

  // Load properties on mount
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      setProperties(data);
      if (data.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load properties", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyCreated = (newProperty: Property) => {
    setProperties([newProperty, ...properties]);
    setSelectedPropertyId(newProperty.id);
    setShowAddForm(false);
    setShowComparison(false);
  };

  const handlePropertyUpdated = (updatedProperty: Property) => {
    setProperties(properties.map((p) => (p.id === updatedProperty.id ? updatedProperty : p)));
  };

  const handlePropertyDeleted = async (id: number) => {
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const filtered = properties.filter((p) => p.id !== id);
        setProperties(filtered);
        // Deselect or select first available
        if (selectedPropertyId === id) {
          setSelectedPropertyId(filtered.length > 0 ? filtered[0].id : null);
        }
        // Remove from comparison
        setComparisonIds(comparisonIds.filter(cid => cid !== id));
      }
    } catch (err) {
      console.error("Failed to delete property", err);
    }
  };

  // Toggle property in the comparison pool
  const toggleComparison = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the card
    if (comparisonIds.includes(id)) {
      setComparisonIds(comparisonIds.filter((cid) => cid !== id));
    } else {
      if (comparisonIds.length >= 4) {
        alert("You can compare a maximum of 4 properties side-by-side.");
        return;
      }
      setComparisonIds([...comparisonIds, id]);
    }
  };

  // Properties list processing
  const filteredAndSortedProperties = properties
    .filter((p) => {
      const matchesSearch = p.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "score") {
        return b.overallScore - a.overallScore;
      }
      if (sortBy === "price_asc") {
        return a.price - b.price;
      }
      if (sortBy === "price_desc") {
        return b.price - a.price;
      }
      if (sortBy === "acres") {
        return b.landSize - a.landSize;
      }
      return 0;
    });

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const comparisonProperties = properties.filter((p) => comparisonIds.includes(p.id));

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col font-sans text-text-main selection:bg-accent-dark/30 selection:text-white">
      
      {/* Dynamic Top Navigation Bar */}
      <header className="bg-card-dark border-b border-border-dark text-text-main shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Logo Heading */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-dark text-bg-dark rounded-lg flex items-center justify-center font-black shadow-md shrink-0">
              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: "15s" }} />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-text-main">Property Scout</h1>
              <p className="text-[10px] text-text-dim font-medium font-mono uppercase tracking-wider">
                Victoria Acreage Acquisition Dashboard
              </p>
            </div>
          </div>

          {/* Hardcoded system evaluation goals metrics */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] bg-bg-dark px-3 py-1.5 rounded-lg border border-border-dark font-mono tracking-tight text-text-dim">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-accent-dark rounded-full"></span>
              <span>Work: Moorabbin VIC</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-success-dark rounded-full"></span>
              <span>Budget Limit: $1,000,000</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-warning-dark rounded-full"></span>
              <span>Min Land: 2 Acres (3+ Ideal)</span>
            </div>
          </div>

          {/* Action Comparison buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAddForm(true);
                setShowComparison(false);
              }}
              id="header-create-property-btn"
              className="py-1.5 px-3 rounded-lg bg-accent-dark text-bg-dark hover:bg-sky-400 hover:scale-[1.02] active:scale-[0.98] font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Evaluate New
            </button>
            
            <button
              onClick={() => {
                setShowComparison(!showComparison);
                setShowAddForm(false);
              }}
              id="header-compare-properties-btn"
              className={`py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer ${
                showComparison
                  ? "bg-success-dark text-bg-dark border-success-dark hover:bg-emerald-400 hover:scale-[1.02]"
                  : comparisonIds.length > 0
                  ? "bg-border-dark text-text-main border-border-dark hover:bg-slate-800"
                  : "bg-card-dark text-text-dim/40 border-border-dark/50 cursor-not-allowed"
              }`}
              disabled={comparisonIds.length === 0}
            >
              <Scale className="w-4 h-4" />
              Compare ({comparisonIds.length})
            </button>
          </div>

        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl w-full mx-auto p-4 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Left Column - Properties Panel (Column span 4) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col h-[calc(100vh-140px)] sticky top-20">
          
          {/* Header Search and Filter */}
          <div className="bg-card-dark p-4 border border-border-dark rounded-xl shadow-md space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-text-dim absolute top-3 left-3" />
              <input
                type="text"
                id="properties-search-input"
                placeholder="Search location, keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs py-2 pl-9 pr-3 border border-border-dark rounded-lg focus:outline-none focus:border-accent-dark font-sans text-text-main bg-bg-dark transition-colors"
              />
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* Filter dropdown */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-0.5">
                  <Filter className="w-3 h-3 text-accent-dark" /> Status
                </span>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PropertyStatus | "All")}
                  className="w-full py-1.5 px-2 bg-bg-dark border border-border-dark rounded-md text-text-main font-medium cursor-pointer focus:outline-none focus:border-accent-dark"
                >
                  <option value="All">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Interested">Interested</option>
                  <option value="Inspecting">Inspecting</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Purchased">Purchased</option>
                </select>
              </div>

              {/* Sort dropdown */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider flex items-center gap-0.5">
                  <ChevronsUpDown className="w-3 h-3 text-accent-dark" /> Sort
                </span>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full py-1.5 px-2 bg-bg-dark border border-border-dark rounded-md text-text-main font-medium cursor-pointer focus:outline-none focus:border-accent-dark"
                >
                  <option value="score">Overall Score</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="acres">Land Size (Acres)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Listings List - scrollable container */}
          <div className="flex-grow overflow-y-auto space-y-3 pr-1.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-text-dim font-medium">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent-dark" />
                Retrieving property database...
              </div>
            ) : filteredAndSortedProperties.length === 0 ? (
              <div className="bg-card-dark border border-border-dark rounded-xl p-8 text-center text-text-dim shadow-md">
                <p className="text-xs font-semibold text-text-main">No property matches found</p>
                <p className="text-[11px] text-text-dim mt-1 max-w-xs mx-auto">
                  Try adjusting filters or search query, or click "Evaluate New" to analyze a fresh Victoria acreage listing.
                </p>
              </div>
            ) : (
              filteredAndSortedProperties.map((p) => {
                const isCompared = comparisonIds.includes(p.id);
                return (
                  <div key={p.id} className="relative">
                    <PropertyCard
                      property={p}
                      isSelected={selectedPropertyId === p.id && !showComparison && !showAddForm}
                      onSelect={() => {
                        setSelectedPropertyId(p.id);
                        setShowAddForm(false);
                        setShowComparison(false);
                      }}
                    />
                    {/* Compare overlay button */}
                    <button
                      onClick={(e) => toggleComparison(p.id, e)}
                      id={`compare-checkbox-btn-${p.id}`}
                      className={`absolute bottom-3 right-3 p-1.5 rounded-md border font-bold text-[9px] uppercase tracking-wider transition-all z-10 flex items-center gap-1 shadow-sm cursor-pointer ${
                        isCompared 
                          ? "bg-accent-dark/10 border-accent-dark text-accent-dark" 
                          : "bg-bg-dark/80 border-border-dark text-text-dim hover:text-text-main hover:bg-bg-dark"
                      }`}
                    >
                      {isCompared ? "Compared ✓" : "Compare"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Active Screen Container (Column span 8) */}
        <div className="lg:col-span-8">
          
          {/* Section: Add Form View */}
          {showAddForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-lg flex items-center gap-1 text-text-main">
                  Evaluate Acreage Listing
                </h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 px-2.5 rounded bg-border-dark hover:bg-slate-800 font-bold text-xs text-text-main shrink-0 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <PropertyForm onSuccess={handlePropertyCreated} />
            </div>
          )}

          {/* Section: Comparison View */}
          {showComparison && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-lg flex items-center gap-1.5 text-text-main">
                  <Scale className="w-5 h-5 text-accent-dark" />
                  Side-by-Side Assessment
                </h2>
                <button
                  onClick={() => setShowComparison(false)}
                  className="p-1 px-2.5 rounded bg-border-dark hover:bg-slate-800 font-bold text-xs text-text-main uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Back to Details
                </button>
              </div>
              <ComparisonView 
                properties={comparisonProperties} 
                onSelectProperty={(id) => {
                  setSelectedPropertyId(id);
                  setShowComparison(false);
                  setShowAddForm(false);
                }}
              />
            </div>
          )}

          {/* Section: Detail View (the default screen when listings exist) */}
          {!showAddForm && !showComparison && selectedProperty && (
            <PropertyDetail
              property={selectedProperty}
              onUpdate={handlePropertyUpdated}
              onDelete={handlePropertyDeleted}
            />
          )}

          {/* Default Splash greeting card if database is fully empty */}
          {!showAddForm && !showComparison && !selectedProperty && !loading && (
            <div className="bg-card-dark border border-border-dark rounded-xl p-10 shadow-lg text-center max-w-xl mx-auto flex flex-col items-center justify-center mt-12">
              <div className="p-4 bg-accent-dark/10 text-accent-dark rounded-full mb-4">
                <LandPlot className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-text-main">Welcome to Property Scout</h2>
              <p className="text-xs text-text-dim max-w-sm mt-2 leading-relaxed">
                A highly-polished personal property evaluation dashboard for investigating rural or acreage properties in Victoria, Australia.
              </p>
              
              <div className="bg-bg-dark p-4 border border-border-dark rounded-xl text-left text-xs text-text-dim w-full my-6 space-y-2 leading-relaxed">
                <p className="font-bold text-text-main text-sm">How to get started:</p>
                <p>1. Copy any acreage property listing URL from <span className="font-semibold text-text-main">domain.com.au</span> or <span className="font-semibold text-text-main">realestate.com.au</span></p>
                <p>2. Click <span className="font-semibold text-text-main">Evaluate New</span> in the top-right toolbar</p>
                <p>3. Paste your URL or listing description, or input manually for instantaneous AI extraction!</p>
              </div>

              <button
                onClick={() => setShowAddForm(true)}
                id="default-splash-create-btn"
                className="py-2.5 px-6 bg-accent-dark text-bg-dark rounded-lg hover:bg-sky-400 font-bold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Import First Property
              </button>
            </div>
          )}

        </div>

      </main>

      {/* Page simple footer */}
      <footer className="bg-card-dark border-t border-border-dark text-text-dim py-4 text-center text-[10px] font-mono mt-8">
        PROPERTY SCOUT ACQUISITION WORKSPACE • Moorabbin VIC 3189, Australia • Strictly Personal Use Only
      </footer>

    </div>
  );
}
