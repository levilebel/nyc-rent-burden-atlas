# Independent verification

Generated 2026-10-12 23:06 by `pipeline/verify_outputs.R` (base R; shares no code with the build pipeline).
Data build checked: 2026-10-12 23:06 EDT. Raw inputs: original HW4 files (read-only).

**Validation checks: 60 PASS, 0 FAIL** (RECOMPUTE 47/47; REFERENCE 4/4; CONSISTENCY 9/9). Informational lines: 3 (not counted).
**Independent statistical validations** (RECOMPUTE + REFERENCE): 51 of 51 pass.

Categories: **RECOMPUTE** = recomputed from raw files with separate code; **REFERENCE** = compared with Homework 4 figure values (hand-transcribed) or the HW3 derived file; **CONSISTENCY** = internal checks of the published files; **INFO** = descriptive, not a validation.

| Category | Area | Check | Result | Detail |
|---|---|---|---|---|
| RECOMPUTE | ZIP | Same set of ZCTAs as the HW4 ZIP rule | PASS | 185 raw vs 185 site |
| RECOMPUTE | ZIP | Borough of every ZCTA | PASS | 185 compared |
| RECOMPUTE | ZIP | Renter households with computed burden (denominator) | PASS |  |
| RECOMPUTE | ZIP | Total renter households | PASS |  |
| RECOMPUTE | ZIP | Rent-burdened households | PASS |  |
| RECOMPUTE | ZIP | Severely burdened households | PASS |  |
| RECOMPUTE | ZIP | Rent burden rate (±0.005, 2-dp rounding) | PASS |  |
| RECOMPUTE | ZIP | Severe rate (±0.005) | PASS |  |
| RECOMPUTE | ZIP | 90% MOE of rent burden rate (±0.005) | PASS |  |
| RECOMPUTE | ZIP | 90% MOE of severe rate (±0.005) | PASS |  |
| RECOMPUTE | ZIP | Coefficient of variation (±0.05, 1-dp rounding) | PASS |  |
| RECOMPUTE | ZIP | Reliability class (High/Moderate/Low/none) | PASS | good 165; low 2; moderate 12; none 6 |
| RECOMPUTE | Borough | Manhattan — counts and pooled rates | PASS | 47.9% burden, 25.3% severe, 553,722 renter hh |
| RECOMPUTE | Borough | Manhattan — 90% MOE of rate (±0.001) | PASS | ±0.86 pts |
| RECOMPUTE | Borough | Bronx — counts and pooled rates | PASS | 60.1% burden, 35.9% severe, 407,159 renter hh |
| RECOMPUTE | Borough | Bronx — 90% MOE of rate (±0.001) | PASS | ±1.00 pts |
| RECOMPUTE | Borough | Brooklyn — counts and pooled rates | PASS | 50.8% burden, 28.1% severe, 678,822 renter hh |
| RECOMPUTE | Borough | Brooklyn — 90% MOE of rate (±0.001) | PASS | ±0.65 pts |
| RECOMPUTE | Borough | Queens — counts and pooled rates | PASS | 52.9% burden, 28.1% severe, 438,739 renter hh |
| RECOMPUTE | Borough | Queens — 90% MOE of rate (±0.001) | PASS | ±0.80 pts |
| RECOMPUTE | Borough | Staten Island — counts and pooled rates | PASS | 56.8% burden, 32.1% severe, 50,477 renter hh |
| RECOMPUTE | Borough | Staten Island — 90% MOE of rate (±0.001) | PASS | ±2.41 pts |
| RECOMPUTE | Borough | New York City — counts and pooled rates | PASS | 52.4% burden, 28.9% severe, 2,128,919 renter hh |
| RECOMPUTE | Borough | New York City — 90% MOE of rate (±0.001) | PASS | ±0.40 pts |
| RECOMPUTE | HPD | Counted units by borough (all records) | PASS | Queens, Brooklyn, Manhattan, Bronx, Staten Island |
| RECOMPUTE | HPD | NYC counted units (all records) | PASS | 320,946 |
| RECOMPUTE | HPD | Counted units per ZIP (postcode match, 0 if none) | PASS |  |
| RECOMPUTE | HPD | Rental / homeownership units per ZIP | PASS |  |
| RECOMPUTE | HPD | Units per 1,000 renter households (±0.005) | PASS |  |
| RECOMPUTE | HPD | Rental units per 1,000 renter households (±0.005) | PASS |  |
| RECOMPUTE | HPD | Borough units per 1,000 renter households (±0.001) | PASS |  |
| RECOMPUTE | HPD | Year series total = raw total with a start date | PASS |  |
| RECOMPUTE | HPD | New Construction — NYC total | PASS |  |
| RECOMPUTE | HPD | Preservation — NYC total | PASS |  |
| RECOMPUTE | Income | Median income = B19013 ("250,000+" and "-" → NA, as in HW4) | PASS |  |
| RECOMPUTE | Income | Top-coded flags match the raw "250,000+" cells | PASS | 10004, 10007, 10282 |
| INFO | Index | Ties created by 2-dp rounding (why ranks use unrounded values) | INFO | 6 duplicated rounded rates vs 0 unrounded |
| RECOMPUTE | Index | HW4 HPD pressure index (±0.06, 1-dp rounding) | PASS |  |
| RECOMPUTE | Index | HW4 HPD pressure top 10 (order) | PASS |  |
| RECOMPUTE | Index | HW4 income pressure index (±0.06) | PASS |  |
| RECOMPUTE | Index | HW4 HPD-activity top 10 (order) | PASS |  |
| RECOMPUTE | Alternative | Universe (CV ≤ 30% and ≥ 1,000 renter hh) | PASS | 173 of 179 ZCTAs |
| RECOMPUTE | Alternative | Alternative index values (±0.06) | PASS |  |
| RECOMPUTE | Alternative | Alternative top 10 (order) | PASS | 11428, 10309, 10312, 11356, 11364, 10308, 11429, 11414, 11354, 11416 |
| RECOMPUTE | Excluded ZCTAs | 10162/10279 counts, rates and 90% MOEs | PASS | 10162: 51.6% ± 28.6; 10279: 0.0% ± 33.3 |
| RECOMPUTE | Excluded ZCTAs | Manhattan rate with both ZCTAs included (±0.001) | PASS | 47.917% |
| RECOMPUTE | Stats | Income–burden Pearson r (NYC) | PASS | r = -0.670 |
| RECOMPUTE | Stats | NYC median of ZIP rent burden rates | PASS |  |
| REFERENCE | HW4 | Borough rates = labels on HW4 figure rent_burden_by_borough.png | PASS |  |
| REFERENCE | HW4 | Top-10 pressure ZIPs, order and burden rates = HW4 figure | PASS | compared with unrounded raw rates rounded once, as in HW4 |
| REFERENCE | HW4 | Top-10 HPD-activity ZIPs, order and units per 1,000 = HW4 figure | PASS | compared with unrounded raw values rounded once, as in HW4 |
| REFERENCE | HW3 | Brooklyn burdened and valid-renter counts = HW3 derived file | PASS | 38 Brooklyn ZCTAs |
| CONSISTENCY | ZIP | No duplicate ZIPs | PASS |  |
| CONSISTENCY | ZIP | Brackets sum to burdened households | PASS |  |
| CONSISTENCY | ZIP | Severe rate ≤ total rate; rates within 0–100 | PASS |  |
| CONSISTENCY | ZIP | ZCTAs without computed renters carry reliability 'none' | PASS | 10020, 11359, 11371, 11424, 11430, 10311 |
| CONSISTENCY | Alternative | Excluded ZCTAs carry a reason and no alternative index | PASS |  |
| CONSISTENCY | Excluded ZCTAs | 10162/10279 absent from ZIP data, totals and rankings | PASS |  |
| CONSISTENCY | Geo | One polygon per analysed ZCTA (+ 2 flagged excluded) | PASS |  |
| CONSISTENCY | Geo | Polygon borough = data borough | PASS |  |
| CONSISTENCY | Geo | All coordinates within the NYC bounding box | PASS |  |
| INFO | ZIP | ZCTAs with computable rates by borough | INFO | Bronx 25; Brooklyn 38; Manhattan 44; Queens 60; Staten Island 12 |
| INFO | Data | Build checked | INFO | 2026-10-12 23:06 EDT |
