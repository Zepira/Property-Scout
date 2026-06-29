# First Home Buyer Profile — Design Spec

**Date:** 2026-06-29  
**Status:** Approved  

---

## Overview

Add a second buyer profile ("First Home Buyer") to Property Scout alongside the existing farm property profile. A dropdown at the top of the page switches between profiles. Each profile has its own property list, scoring model, commute destination, and financial calculator view.

This change also migrates the database from the JSON file shim to real SQLite using the already-installed `sqlite` + `sqlite3` packages.

---

## 1. Database Migration (JSON → SQLite)

### Why

The existing `server/db.ts` uses a JSON file (`properties_db.json`) via a shim that implements a SQLite-like interface. The `sqlite` and `sqlite3` packages are already in `package.json` but bypassed. Profile support requires relational structure (properties belong to a profile), making this the right time to use real SQLite.

### Schema

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id   TEXT PRIMARY KEY,  -- 'farm' | 'firsthome'
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  TEXT NOT NULL REFERENCES profiles(id),
  address     TEXT,
  price       INTEGER,
  land_acres  REAL,
  land_sqm    INTEGER,
  beds        INTEGER,
  baths       INTEGER,
  garages     INTEGER,
  status      TEXT DEFAULT 'New',
  notes       TEXT,
  lat         REAL,
  lng         REAL,
  commute_am  INTEGER,
  commute_pm  INTEGER,
  is_new_build INTEGER DEFAULT 0,  -- 1 = new build (affects FHOG eligibility)
  scores      TEXT,        -- JSON blob: { overall, commute, budget, land, horse, buildability, houseSize }
  features    TEXT,        -- JSON blob: all boolean feature flags
  ai_insights TEXT,        -- JSON blob: AI-extracted insights
  images      TEXT,        -- JSON blob: image URLs array
  raw_data    TEXT,        -- JSON blob: any remaining fields not in columns
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### Seed Data

On startup, insert profiles if they don't exist:
```sql
INSERT OR IGNORE INTO profiles VALUES ('farm', 'Farm Property');
INSERT OR IGNORE INTO profiles VALUES ('firsthome', 'First Home Buyer');
```

Migrate existing seed properties from `server/db.ts` into the `farm` profile.

### Migration from JSON

On server startup, if `properties_db.json` exists:
1. Read all properties from the JSON file
2. Insert each into SQLite with `profile_id = 'farm'`
3. Rename `properties_db.json` → `properties_db.json.bak`

If the file doesn't exist or is already migrated, skip silently.

---

## 2. Profile System

### Backend

All `/api/properties` endpoints accept and require a `?profile=` query parameter (`farm` | `firsthome`). Requests without a valid profile return a 400 error.

New endpoint: `GET /api/profiles` — returns the list of available profiles (id + name). Used by the frontend dropdown.

### Frontend State

Active profile stored in `localStorage` under key `property-scout-profile`, defaulting to `'farm'` if unset. Stored at the `App` component level and passed down via props (no context needed given the app's size).

When the profile changes:
- Refetch the property list
- Clear any selected property / comparison selection
- Update the financial calculator mode

### ProfileSelector Component

A dropdown rendered at the top of the left panel (above the sort/filter controls). Shows the current profile name and switches on change. Styled to match the existing dark theme (slate background, cyan accent).

---

## 3. Scoring Models

### Farm Profile — Unchanged Weights

| Dimension | Weight | Notes |
|-----------|--------|-------|
| Commute | 35% | To Moorabbin (12 Elna Court) |
| Land | 25% | Acreage, 2–20+ acres |
| Budget | 20% | Cap $800k–$1M |
| Horse | 10% | Facilities + acreage |
| Buildability | 10% | Infrastructure |

Commute destination is no longer hardcoded — it's read from a profile config object.

### First Home Buyer Profile — New Scoring Function

| Dimension | Weight | Scoring Logic |
|-----------|--------|--------------|
| Budget | 35% | ≤$700k = 100, ≤$750k = 85, ≤$800k = 65, ≤$900k = 35, >$900k = 10 |
| House Size | 25% | Beds (50%): 4+=100, 3=75, 2=40, 1=15. Baths (30%): 2+=100, 1=55. Garage (20%): 2+=100, 1=70, 0=0 |
| Land Size | 20% | 800sqm+=100, 600–800=80, 400–600=60, 300–400=40, <300=20 |
| Commute | 20% | To Marnebek School, Cranbourne. ≤15min=100, ≤25min=80, ≤35min=60, ≤45min=35, >45min=10 |

### Profile Config (server/scoring.ts)

```ts
export const PROFILE_CONFIG = {
  farm: {
    workplaceLabel: 'Moorabbin',
    workplaceLat: -37.947291,
    workplaceLng: 145.064560,
  },
  firsthome: {
    workplaceLabel: 'Marnebek School, Cranbourne',
    workplaceLat: -38.1156,   // approximate — geocoded on first run
    workplaceLng: 145.2831,
  },
};
```

On first run for the `firsthome` profile, geocode "Marnebek School, Cranbourne VIC" via the Maps API and persist the result. Fall back to the hardcoded approximation if the API is unavailable.

---

## 4. Property Form — Profile-Aware Fields

### Farm Mode (existing)
Fields: address, price, land (acres), beds, baths, horse facilities, dam, stables, shed, power, septic, water tank.

### First Home Buyer Mode (new)
Fields: address, price, beds, baths, garages, land (sqm), property type (house / townhouse / unit), new or established (affects FHOG eligibility).

Farm-specific fields (horse score inputs) are hidden in FHB mode. Land input changes unit from acres to sqm.

---

## 5. FHB Financial Panel

Replaces the existing `FinancialCalculator` display when profile is `firsthome`. Three sub-sections:

### Sub-section A: Scheme Eligibility

Auto-calculated from property price. Each scheme shows as:
- ✅ Green — eligible based on price
- ⚠️ Amber — may be eligible (check income/conditions)
- ✗ Grey — not applicable at this price

| Scheme | Trigger | Display |
|--------|---------|---------|
| First Home Guarantee | price ≤ $800k | 5% deposit, no LMI. 35,000 places/yr nationally. |
| Stamp Duty Exemption | price ≤ $600k | Full exemption. Show dollar saving. |
| Stamp Duty Concession | $600k < price ≤ $750k | Sliding scale. Show calculated saving vs full duty. |
| Full Stamp Duty | price > $750k | Standard Victorian duty applies. |
| First Home Owner Grant | price ≤ $750k AND new build | $10,000 at settlement. Greyed out if established. |
| Help to Buy | price ≤ $950k | Govt equity 30% (existing) / 40% (new). Flag: "Verify availability at Housing Australia — income caps apply ($90k single / $120k couple)." |

### Stamp Duty Calculation

Victorian transfer duty brackets (2024):
- ≤ $25,000: 1.4%
- $25,001–$130,000: $350 + 2.4% of excess
- $130,001–$960,000: $2,870 + 6% of excess
- > $960,000: $28,070 + 5.5% of excess

First home buyer concession (price $600k–$750k):
```
concession = full_duty × ((750,000 − price) / 150,000)
duty_payable = full_duty − concession
```

Example at $700k: full duty $37,070 → concession $12,357 → duty payable $24,713.

### Sub-section B: Cash Required Breakdown

Inputs: deposit % selector (5% / 10% / 20%) + "Using Help to Buy" toggle.

| Line Item | Notes |
|-----------|-------|
| Deposit | price × deposit% |
| Stamp duty | FHB concession applied if eligible |
| Legal / conveyancing | Fixed $2,500 |
| Building inspection | Fixed $800 |
| FHOG offset | − $10,000 if new build ≤ $750k |
| LMI | $0 if using First Home Guarantee or 20% deposit; estimated otherwise |
| **Total cash required** | Sum of above |

LMI estimate (if applicable): approximately 1.5–3% of loan amount at high LVR, shown as a range with a note to get lender quote.

### Sub-section C: Monthly Repayments

Loan amount = price − deposit − (Help to Buy equity contribution if toggled).

Repayment table: 5.5% / 6.0% / 6.5% × 25yr / 30yr = 6 cells.

Extra row unique to FHB: **Rental income offset** — input for weekly room rental income (default: 2 rooms × $200 = $400/week). Shows effective monthly cost after rental offset below the table.

Example at $700k, 5% deposit (First Home Guarantee), 6.0%, 30yr:
- Loan: $665,000
- Monthly repayment: ~$3,987
- Rental offset (2 rooms): −$1,733/month
- Effective monthly cost: ~$2,254

---

## 6. UI / Scoring Display Changes

### Property Cards

FHB profile cards replace the farm score labels:

| Farm label | FHB label |
|------------|-----------|
| Commute | Commute |
| Land | Land Size |
| Budget | Budget |
| Horse | House |
| Build | — (hidden) |

### Score Breakdown in Detail View

Shows the four FHB dimensions with their weighted contribution. "Horse facilities" and "Buildability" panels are hidden in FHB mode.

### Map

The Google Maps display updates the workplace marker to Marnebek School, Cranbourne when in FHB mode.

---

## 7. Out of Scope

- Multi-user support / authentication
- Shared properties between profiles
- Income-based scheme eligibility calculation (shown as amber with note to check)
- Automatic scheme application tracking
- Integration with any government scheme portal

---

## Files to Change

| File | Change |
|------|--------|
| `server/db.ts` | Replace JSON shim with real SQLite; add migration logic |
| `server/scoring.ts` | Add `scoreFHB()`, add `PROFILE_CONFIG`, make commute destination dynamic |
| `server/analyzer.ts` | Pass profile to extraction so FHB fields are requested from Gemini |
| `server.ts` | Add `?profile=` param to all property routes; add `GET /api/profiles` |
| `src/types.ts` | Add `profile` field to `Property`; add `Profile` type; update score shape |
| `src/App.tsx` | Add profile state + localStorage persistence; pass to all children |
| `src/components/PropertyForm.tsx` | Profile-aware field visibility (FHB vs farm fields) |
| `src/components/FinancialCalculator.tsx` | Add FHB mode: scheme panel + cash breakdown + rental offset |
| `src/components/PropertyCard.tsx` | Profile-aware score labels |
| `src/components/PropertyDetail.tsx` | Profile-aware score breakdown display |
| `src/components/PropertyMap.tsx` | Dynamic workplace marker from profile config |
| `src/components/ProfileSelector.tsx` | **New** — dropdown component |
