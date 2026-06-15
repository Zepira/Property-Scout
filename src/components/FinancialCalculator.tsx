import React, { useState } from "react";

interface FinancialCalculatorProps {
  price: number;
}

export function calculateVicStampDuty(price: number): number {
  if (price <= 25000) {
    return price * 0.014;
  } else if (price <= 130000) {
    return 350 + (price - 25000) * 0.024;
  } else if (price <= 960000) {
    return 2870 + (price - 130000) * 0.06;
  } else {
    return 52670 + (price - 960000) * 0.055;
  }
}

export default function FinancialCalculator({ price }: FinancialCalculatorProps) {
  const [depositPct, setDepositPct] = useState<5 | 10 | 20>(20);
  const [selectedRate, setSelectedRate] = useState<5.5 | 6.0 | 6.5>(6.0);
  const [selectedTerm, setSelectedTerm] = useState<25 | 30>(30);

  const legalCosts = 2500;
  const buildingInspection = 800;

  const depositAmount = price * (depositPct / 100);
  const loanPrincipal = Math.max(0, price - depositAmount);
  const stampDuty = calculateVicStampDuty(price);
  const totalUpfrontCost = depositAmount + stampDuty + legalCosts + buildingInspection;

  // Monthly payment calculator formula
  const getMonthlyPayment = (principal: number, annualRate: number, years: number) => {
    if (principal <= 0) return 0;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const getRepayments = (years: number, rate: number) => {
    const monthly = getMonthlyPayment(loanPrincipal, rate, years);
    const weekly = (monthly * 12) / 52;
    return { monthly, weekly };
  };

  return (
    <div className="bg-card-dark border border-border-dark rounded-xl overflow-hidden shadow-lg animate-fade-in" id="financial-calculator">
      {/* Header Banner */}
      <div className="bg-bg-dark border-b border-border-dark px-5 py-4">
        <h3 className="font-semibold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wide">
          <svg className="w-4 h-4 text-success-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Victorian Buying Financials
        </h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Deposit Selector Options */}
        <div>
          <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2 block">
            Select Deposit Percentage
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([5, 10, 20] as const).map((pct) => (
              <button
                key={pct}
                id={`deposit-btn-${pct}`}
                onClick={() => setDepositPct(pct)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  depositPct === pct
                    ? "bg-accent-dark border-accent-dark text-bg-dark shadow-md"
                    : "bg-bg-dark border-border-dark text-text-dim hover:bg-slate-800/60 hover:text-text-main"
                }`}
              >
                {pct}% Deposit ({((price * pct) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })})
              </button>
            ))}
          </div>
        </div>

        {/* Upfront Costs Breakdown */}
        <div className="bg-bg-dark rounded-xl p-4 border border-border-dark">
          <h4 className="text-xs font-bold text-accent-dark uppercase tracking-wider mb-3">
            Estimated Upfront Costs
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-text-dim">
              <span>Deposit ({depositPct}%):</span>
              <span className="font-mono font-semibold text-text-main">
                {depositAmount.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between text-text-dim">
              <span>VIC Stamp Duty (Transfer Duty):</span>
              <span className="font-mono font-semibold text-text-main">
                {stampDuty.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between text-text-dim">
              <span>Estimated Legal Costs & Conveyancing:</span>
              <span className="font-mono font-semibold text-text-main">
                {legalCosts.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between text-text-dim pb-2 border-b border-border-dark/60">
              <span>Estimated Building & Pest Inspection:</span>
              <span className="font-mono font-semibold text-text-main">
                {buildingInspection.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1">
              <span className="text-success-dark">Total Upfront Cash Needed:</span>
              <span className="font-mono text-success-dark text-sm">
                {totalUpfrontCost.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Loan Principal Card */}
        <div className="flex justify-between items-center text-xs border border-border-dark p-2.5 rounded-lg bg-bg-dark">
          <span className="text-text-dim font-medium font-sans uppercase tracking-wider">Loan Principal (Mortgage):</span>
          <span className="font-bold text-text-main font-mono text-sm">
            {loanPrincipal.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Interactive Mortgage Estimates */}
        <div>
          <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3 block">
            Mortgage Repayments Table
          </label>
          <div className="overflow-x-auto border border-border-dark rounded-lg">
            <table className="min-w-full text-xs text-left divide-y divide-border-dark">
              <thead className="bg-bg-dark">
                <tr>
                  <th className="px-3 py-2 text-text-dim font-bold">Term / Rate</th>
                  <th className="px-3 py-2 text-text-dim font-bold text-right">5.5%</th>
                  <th className="px-3 py-2 text-text-dim font-bold text-right">6.0%</th>
                  <th className="px-3 py-2 text-text-dim font-bold text-right">6.5%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark font-mono bg-card-dark text-text-main">
                {/* 25 Year Term Row */}
                <tr>
                  <td className="px-3 py-2 text-text-main font-sans font-semibold bg-bg-dark/40">25 Years</td>
                  {([5.5, 6.0, 6.5] as const).map((rate) => {
                    const pay = getRepayments(25, rate);
                    return (
                      <td key={rate} className="px-3 py-2 text-right">
                        <div className="text-text-main font-bold">
                          {pay.monthly.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}/mo
                        </div>
                        <div className="text-text-dim text-[10px]">
                          {pay.weekly.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}/wk
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* 30 Year Term Row */}
                <tr>
                  <td className="px-3 py-2 text-text-main font-sans font-semibold bg-bg-dark/40">30 Years</td>
                  {([5.5, 6.0, 6.5] as const).map((rate) => {
                    const pay = getRepayments(30, rate);
                    return (
                      <td key={rate} className="px-3 py-2 text-right">
                        <div className="text-text-main font-bold">
                          {pay.monthly.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}/mo
                        </div>
                        <div className="text-text-dim text-[10px]">
                          {pay.weekly.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })}/wk
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-text-dim mt-2 italic font-sans">
            Rates are indicator estimates only. Actual credit checks and terms can affect ultimate monthly payments.
          </p>
        </div>
      </div>
    </div>
  );
}
