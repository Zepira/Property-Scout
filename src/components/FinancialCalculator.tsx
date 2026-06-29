import React, { useState } from "react";
import { ProfileId } from '../types';

interface FinancialCalculatorProps {
  price: number;
  isNewBuild?: boolean;
  activeProfile: ProfileId;
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

function calcFHBDuty(price: number): number {
  const full = calculateVicStampDuty(price);
  if (price <= 600000) return 0;
  if (price <= 750000) {
    const concession = full * ((750000 - price) / 150000);
    return Math.round(full - concession);
  }
  return Math.round(full);
}

function calcFHBDutySaving(price: number): number {
  return Math.round(calculateVicStampDuty(price) - calcFHBDuty(price));
}

function calcLMI(loanAmount: number, lvr: number): number {
  if (lvr <= 0.80) return 0;
  if (lvr <= 0.85) return Math.round(loanAmount * 0.006);
  if (lvr <= 0.90) return Math.round(loanAmount * 0.012);
  if (lvr <= 0.95) return Math.round(loanAmount * 0.028);
  return Math.round(loanAmount * 0.038);
}

function monthlyRepayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

type SchemeStatus = 'green' | 'amber' | 'grey';

function SchemePanel({ price, isNewBuild }: { price: number; isNewBuild: boolean }) {
  const fmt = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const fhgEligible = price <= 800000;
  const dutyExempt = price <= 600000;
  const dutyConcession = price > 600000 && price <= 750000;
  const fhogEligible = isNewBuild && price <= 750000;
  const dutySaving = calcFHBDutySaving(price);

  const schemes: { label: string; detail: string; status: SchemeStatus; note: string }[] = [
    {
      label: 'First Home Guarantee',
      detail: '5% deposit · no LMI · 35,000 places/yr nationally',
      status: fhgEligible ? 'green' : 'grey',
      note: fhgEligible
        ? 'Eligible (Vic metro cap $800k) — verify income ≤ $125k single / $200k couple'
        : 'Over Vic metro cap of $800k',
    },
    {
      label: 'Stamp Duty',
      detail: dutyExempt ? 'Full exemption' : dutyConcession ? `Concession — save ${fmt(dutySaving)}` : 'Full standard duty',
      status: dutyExempt ? 'green' : dutyConcession ? 'amber' : 'grey',
      note: dutyExempt
        ? 'Full exemption — property ≤ $600k'
        : dutyConcession
        ? `Sliding concession for $600k–$750k — duty payable: ${fmt(calcFHBDuty(price))}`
        : 'Above $750k — no FHB stamp duty concession',
    },
    {
      label: 'First Home Owner Grant',
      detail: '$10,000 at settlement — new builds only, ≤ $750k',
      status: fhogEligible ? 'green' : 'grey',
      note: fhogEligible
        ? 'Eligible — new build ≤ $750k'
        : isNewBuild
        ? 'New build but over $750k cap'
        : 'Established property — FHOG not available',
    },
    {
      label: 'Help to Buy',
      detail: `Govt equity ${isNewBuild ? '40%' : '30%'} · income ≤ $90k single / $120k couple`,
      status: price <= 950000 ? 'amber' : 'grey',
      note: price <= 950000
        ? 'May be eligible — verify current availability at housingaustralia.gov.au'
        : 'Over $950k price cap',
    },
  ];

  const iconClass = { green: 'text-success-dark', amber: 'text-warning-dark', grey: 'text-text-dim' } as const;
  const icon = { green: '✓', amber: '⚠', grey: '✗' } as const;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-accent-dark uppercase tracking-wider">Scheme Eligibility</h4>
      {schemes.map(s => (
        <div key={s.label} className="flex gap-3 items-start p-2.5 rounded-lg bg-bg-dark border border-border-dark">
          <span className={`text-base font-bold mt-0.5 ${iconClass[s.status]}`}>{icon[s.status]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-main">{s.label}</div>
            <div className="text-xs text-text-dim mt-0.5">{s.detail}</div>
            <div className={`text-xs mt-0.5 ${iconClass[s.status]}`}>{s.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FinancialCalculator({ price, isNewBuild, activeProfile }: FinancialCalculatorProps) {
  const [depositPct, setDepositPct] = useState<5 | 10 | 20>(20);
  const [selectedRate, setSelectedRate] = useState<5.5 | 6.0 | 6.5>(6.0);
  const [selectedTerm, setSelectedTerm] = useState<25 | 30>(30);
  const [useHelpToBuy, setUseHelpToBuy] = useState(false);
  const [roomRentalWeekly, setRoomRentalWeekly] = useState(400);

  if (activeProfile === 'firsthome') {
    const fmt = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    const deposit = Math.round(price * depositPct / 100);
    const helpToBuyEquity = useHelpToBuy ? Math.round(price * (isNewBuild ? 0.40 : 0.30)) : 0;
    const loanAmount = Math.max(0, price - deposit - helpToBuyEquity);
    const lvr = price > 0 ? loanAmount / price : 0;
    const fhgEligible = price <= 800000;
    const usingFHG = fhgEligible && depositPct === 5;
    const lmi = (usingFHG || depositPct >= 20 || useHelpToBuy) ? 0 : calcLMI(loanAmount, lvr);
    const duty = calcFHBDuty(price);
    const fhogOffset = (isNewBuild && price <= 750000) ? 10000 : 0;
    const totalCash = deposit + duty + 2500 + 800 + lmi - fhogOffset - helpToBuyEquity;
    const rentalOffsetMonthly = Math.round((roomRentalWeekly * 52) / 12);
    const rates = [0.055, 0.06, 0.065] as const;
    const terms = [25, 30] as const;

    return (
      <div className="bg-card-dark border border-border-dark rounded-xl overflow-hidden shadow-lg animate-fade-in">
        <div className="bg-bg-dark border-b border-border-dark px-5 py-4">
          <h3 className="font-semibold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wide">
            <svg className="w-4 h-4 text-success-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            First Home Buyer Financials
          </h3>
        </div>

        <div className="p-5 space-y-6">
          <SchemePanel price={price} isNewBuild={isNewBuild ?? false} />

          {/* Deposit + Help to Buy controls */}
          <div>
            <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2 block">
              Deposit Percentage
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([5, 10, 20] as const).map(pct => (
                <button
                  key={pct}
                  onClick={() => setDepositPct(pct)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    depositPct === pct
                      ? 'bg-accent-dark border-accent-dark text-bg-dark shadow-md'
                      : 'bg-bg-dark border-border-dark text-text-dim hover:bg-slate-800/60 hover:text-text-main'
                  }`}
                >
                  {pct}% ({fmt(Math.round(price * pct / 100))})
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
              <input
                type="checkbox"
                checked={useHelpToBuy}
                onChange={e => setUseHelpToBuy(e.target.checked)}
                className="w-4 h-4 accent-accent-dark"
              />
              Using Help to Buy <span className="text-xs text-text-dim">(govt {isNewBuild ? '40%' : '30%'} equity — verify eligibility)</span>
            </label>
          </div>

          {/* Cash required breakdown */}
          <div className="bg-bg-dark rounded-xl p-4 border border-border-dark">
            <h4 className="text-xs font-bold text-accent-dark uppercase tracking-wider mb-3">
              Estimated Cash Required
            </h4>
            <div className="space-y-2 text-xs">
              {[
                ['Deposit', fmt(deposit)],
                ['Stamp duty (FHB rate)', fmt(duty)],
                ['Legal / conveyancing', fmt(2500)],
                ['Building & pest inspection', fmt(800)],
                ...(lmi > 0 ? [['LMI (estimated)', fmt(lmi)]] : []),
                ...(fhogOffset > 0 ? [['FHOG offset (new build)', `−${fmt(fhogOffset)}`]] : []),
                ...(useHelpToBuy ? [['Help to Buy equity', `−${fmt(helpToBuyEquity)}`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-text-dim">
                  <span>{label}</span>
                  <span className="font-mono font-semibold text-text-main">{value}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border-dark pt-2 text-sm font-bold">
                <span className="text-success-dark">Total cash required</span>
                <span className="font-mono text-success-dark">{fmt(totalCash)}</span>
              </div>
            </div>
          </div>

          {/* Loan + repayments */}
          <div className="flex justify-between items-center text-xs border border-border-dark p-2.5 rounded-lg bg-bg-dark">
            <span className="text-text-dim font-medium uppercase tracking-wider">Loan principal</span>
            <span className="font-bold text-text-main font-mono text-sm">{fmt(loanAmount)}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3 block">
              Monthly Repayments
            </label>
            <div className="overflow-x-auto border border-border-dark rounded-lg">
              <table className="min-w-full text-xs text-left divide-y divide-border-dark">
                <thead className="bg-bg-dark">
                  <tr>
                    <th className="px-3 py-2 text-text-dim font-bold">Term / Rate</th>
                    {rates.map(r => (
                      <th key={r} className="px-3 py-2 text-text-dim font-bold text-right">{(r * 100).toFixed(1)}%</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark font-mono bg-card-dark text-text-main">
                  {terms.map(t => (
                    <tr key={t}>
                      <td className="px-3 py-2 text-text-main font-sans font-semibold bg-bg-dark/40">{t} Years</td>
                      {rates.map(r => {
                        const mo = monthlyRepayment(loanAmount, r, t);
                        const wk = Math.round((mo * 12) / 52);
                        return (
                          <td key={r} className="px-3 py-2 text-right">
                            <div className="text-text-main font-bold">{fmt(mo)}/mo</div>
                            <div className="text-text-dim text-[10px]">{fmt(wk)}/wk</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rental offset */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-dim">Weekly rental income</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-dim">$</span>
                <input
                  type="number" min={0} step={50}
                  value={roomRentalWeekly}
                  onChange={e => setRoomRentalWeekly(Number(e.target.value))}
                  className="w-20 bg-bg-dark border border-border-dark rounded px-2 py-0.5 text-sm text-text-main font-mono focus:outline-none focus:border-accent-dark"
                />
              </div>
              <span className="text-xs text-text-dim">= {fmt(rentalOffsetMonthly)}/mo offset</span>
            </div>
            <div className="mt-1.5 text-xs text-text-dim">
              Effective cost at 6.0% / 30yr with rental:{' '}
              <span className="text-success-dark font-mono font-semibold">
                {fmt(monthlyRepayment(loanAmount, 0.06, 30) - rentalOffsetMonthly)}/mo
              </span>
            </div>
            <p className="text-[10px] text-text-dim mt-2 italic">Rates are indicative only. LMI cost is estimated — get a lender quote.</p>
          </div>
        </div>
      </div>
    );
  }

  // Farm profile: existing calculator — unchanged
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
