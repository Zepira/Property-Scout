import React from "react";
import { Property } from "../types";
import { ArrowUpRight, Scale, Check, Landmark, LandPlot, Moon, CircleAlert } from "lucide-react";

interface ComparisonViewProps {
  properties: Property[];
  onSelectProperty: (id: number) => void;
}

const fmtMins = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h > 0 ? `${h}h ${r}m` : `${r}m`; };

export default function ComparisonView({ properties, onSelectProperty }: ComparisonViewProps) {
  if (properties.length === 0) {
    return (
      <div className="bg-card-dark rounded-xl p-8 border border-border-dark text-center flex flex-col items-center justify-center shadow-lg animate-fade-in">
        <div className="p-3 bg-accent-dark/10 text-accent-dark rounded-full mb-3 animate-pulse">
          <Scale className="w-6 h-6" />
        </div>
        <p className="font-semibold text-text-main text-sm">No Properties Selected for Comparison</p>
        <p className="text-xs text-text-dim max-w-sm mt-1 leading-relaxed">
          Toggle options from the properties panel to compare up to 4 Victorian acreage listings side-by-side.
        </p>
      </div>
    );
  }

  // Find the extreme best values for comparison highlighting
  const prices = properties.map((p) => p.price).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

  const commutes = properties.map((p) => (p.commuteTimeAM + p.commuteTimePM) / 2);
  const minCommute = commutes.length > 0 ? Math.min(...commutes) : 999;

  const landSizes = properties.map((p) => p.landSize);
  const maxLand = landSizes.length > 0 ? Math.max(...landSizes) : 0;

  const scores = properties.map((p) => p.overallScore);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Monthly mortgage calculation helper (for comparison)
  const getRepayment = (price: number) => {
    const interest = 0.06; // 6.0% indicator rate
    const principal = price * 0.8; // 20% deposit
    const r = interest / 12;
    const n = 30 * 12; // 30 year
    if (principal <= 0) return 0;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="comparison-view">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card-dark p-4 rounded-xl border border-border-dark shadow-md">
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wide text-text-main flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-accent-dark" />
            Acreage Comparison Matrix
          </h3>
          <p className="text-xs text-text-dim mt-0.5">
            Comparing {properties.length} {properties.length === 1 ? "listing" : "listings"}. Best-value indicators highlighted in green.
          </p>
        </div>
        <div className="text-[10px] font-mono uppercase bg-bg-dark text-accent-dark px-2.5 py-1 rounded border border-border-dark font-bold">
          Max: 4 properties
        </div>
      </div>

      {/* Side-by-side comparison grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {properties.map((p) => {
          const avgCommute = (p.commuteTimeAM + p.commuteTimePM) / 2;
          const monthlyMortgage = getRepayment(p.price);

          const isBestPrice = p.price > 0 && p.price === minPrice;
          const isBestCommute = avgCommute === minCommute;
          const isBestLand = p.landSize === maxLand;
          const isBestScore = p.overallScore === maxScore;

          return (
            <div
              key={p.id}
              className="bg-card-dark border-2 border-border-dark rounded-xl overflow-hidden shadow-md hover:border-accent-dark transition-all duration-200 flex flex-col justify-between"
            >
              {/* Card top */}
              <div className="p-4 bg-bg-dark/40 border-b border-border-dark/60 flex flex-col justify-between h-40">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase font-mono tracking-wider text-text-dim">
                    ID #{p.id}
                  </span>
                  <h4 className="font-bold text-text-main group-hover:text-accent-dark text-xs truncate">
                    {p.address}
                  </h4>
                  <div className="text-xs font-bold text-accent-dark">
                    {p.price > 0
                      ? p.price.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })
                      : "Contact Agent"}
                  </div>
                </div>

                <div className="flex items-center justify-between pb-1">
                  <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase bg-bg-dark text-text-main rounded border border-border-dark">
                    {p.status}
                  </span>
                  
                  <button
                    onClick={() => onSelectProperty(p.id)}
                    className="text-[10px] font-bold text-accent-dark flex items-center hover:underline cursor-pointer"
                  >
                    View Details
                    <ArrowUpRight className="w-3 h-3 ml-0.5 animate-bounce-subtle" />
                  </button>
                </div>
              </div>

              {/* Specifications row breakdown */}
              <div className="p-4 space-y-4 text-xs font-sans flex-grow bg-card-dark">
                {/* 1. Price row */}
                <div className={`p-2 rounded-lg border ${isBestPrice ? "bg-success-dark/10 border-success-dark/40 text-success-dark" : "bg-bg-dark/50 border-border-dark/40 text-text-main"}`}>
                  <p className="text-[9px] uppercase font-bold text-text-dim">Purchase Price</p>
                  <p className="font-mono font-bold mt-0.5 text-xs">
                    {p.price > 0 ? `$${(p.price / 1000).toFixed(0)}k` : "Contact Agent"}
                  </p>
                  {isBestPrice && <span className="text-[9px] font-bold text-success-dark block mt-0.5">✓ Lowest Price</span>}
                </div>

                {/* 2. Commute travel times */}
                <div className={`p-2 rounded-lg border ${isBestCommute ? "bg-success-dark/10 border-success-dark/40 text-success-dark" : "bg-bg-dark/50 border-border-dark/40 text-text-main"}`}>
                  <p className="text-[9px] uppercase font-bold text-text-dim">Commute to Moorabbin</p>
                  <p className="font-mono font-bold mt-0.5 text-xs">{fmtMins(Math.round(avgCommute))} avg</p>
                  <div className="text-[9px] text-text-dim/80 mt-0.5 font-mono">AM: {fmtMins(p.commuteTimeAM)} • PM: {fmtMins(p.commuteTimePM)}</div>
                  {isBestCommute && <span className="text-[9px] font-bold text-success-dark block mt-0.5">✓ Shortest Commute</span>}
                </div>

                {/* 3. Land Acres */}
                <div className={`p-2 rounded-lg border ${isBestLand ? "bg-success-dark/10 border-success-dark/40 text-success-dark" : "bg-bg-dark/50 border-border-dark/40 text-text-main"}`}>
                  <p className="text-[9px] uppercase font-bold text-text-dim">Land Size</p>
                  <p className="font-mono font-bold mt-0.5 text-xs">{p.landSize.toFixed(1)} Acres</p>
                  {isBestLand && <span className="text-[9px] font-bold text-success-dark block mt-0.5">✓ Largest Acreage</span>}
                </div>

                {/* 4. Scorecard rating */}
                <div className={`p-2 rounded-lg border ${isBestScore ? "bg-accent-dark/10 border-accent-dark/40 text-accent-dark" : "bg-bg-dark/50 border-border-dark/40 text-text-main"}`}>
                  <p className="text-[9px] uppercase font-bold text-text-dim">Overall Evaluated Score</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono font-black text-sm">{p.overallScore}</span>
                    <span className="text-[10px] text-text-dim/80">/ 100</span>
                  </div>
                  {isBestScore && <span className="text-[9px] font-bold text-accent-dark block mt-0.5">★ Highest Score</span>}
                </div>

                {/* 5. 30Y mortgage repayments (6.0% rate, 20% deposit) */}
                <div className="p-2 bg-bg-dark/50 border border-border-dark/40 rounded-lg text-text-main">
                  <p className="text-[9px] uppercase font-bold text-text-dim">Indicative mortgage</p>
                  <p className="font-mono font-bold mt-0.5 text-xs">${monthlyMortgage.toFixed(0)} / mo</p>
                  <p className="text-[9px] text-text-dim mt-0.5">Weekly: ${((monthlyMortgage*12)/52).toFixed(0)} / wk</p>
                </div>
              </div>

              {/* Status Indicators row */}
              <div className="p-4 bg-bg-dark/30 border-t border-border-dark text-[10px] space-y-1 font-mono text-text-dim">
                <div className="flex justify-between">
                  <span>Power Connected:</span>
                  <span className="font-bold text-text-main">{p.powerConnected ? "YES" : "NO"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Septic on site:</span>
                  <span className="font-bold text-text-main">{p.septic ? "YES" : "NO"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Horse Suitable:</span>
                  <span className="text-accent-dark px-1.5 py-0.5 rounded bg-bg-dark border border-border-dark/60 font-bold">{p.horseScore} pts</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
