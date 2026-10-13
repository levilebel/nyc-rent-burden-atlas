# Review: ZCTAs 10162 and 10279

Generated 2026-10-12 22:40 by `pipeline/review_zip_inclusion.R`. **Read-only analysis — dashboard data unchanged.**

## 1. Presence in the original ACS 2024 B25070 file

| ZCTA | NAME in file | Total renter hh (±MOE) | Not computed | Denominator | Burdened (≥30%) | Severe (≥50%) | Any suppressed cell? | HW4 range assigns |
|---|---|---|---|---|---|---|---|---|
| 10162 | ZCTA5 10162 | 746 (±331) | 13 | 733 | 378 | 363 | no | — (excluded) |
| 10279 | ZCTA5 10279 | 84 (±75) | 0 | 84 | 0 | 0 | no | — (excluded) |

| ZCTA | Rent burden rate | 90% MOE | CV | Severe rate | 90% MOE | Reliability class (site rule) |
|---|---|---|---|---|---|---|
| 10162 | 51.6% | ±28.6 pts | 33.8% | 49.5% | ±29.1 pts | low (CV > 30%) |
| 10279 | 0.0% | ±33.3 pts | undefined (estimate = 0) | 0.0% | ±16.7 pts | unusable: zero-count estimate; MOE exceeds the estimate |

Median household income (B19013): 10162 = 114139 (MOE 101432); 10279 = 250,000+ (MOE ***).
HPD records with these postcodes: none.

## 2. Geographic classification

| ZCTA | Area (acres) | Centroid (lat, lon) | Adjacent analysed ZCTAs (≤100 ft) |
|---|---|---|---|
| 10279 | 2.7 | 40.7126, -74.0087 | 10007 (Manhattan) |
| 10162 | 9.5 | 40.7694, -73.9499 | 10075 (Manhattan), 10021 (Manhattan) |

Independent spatial check of borough labels: 7,590 HPD buildings with coordinates were placed inside the 2020 ZCTA polygons (point-in-polygon), covering 156 analysed ZCTAs. Buildings whose HPD Borough differs from the ZCTA's HW4 borough: 10463 (HW4 Bronx; HPD Manhattan: 5 of its buildings, 11%).
HPD buildings located inside 10162/10279: none.

## 3. HW4 inclusion criteria

HW4 includes a ZCTA if (a) its ZIP falls in the hand-coded borough ranges and (b) for rates, `rent_burden_denominator > 0`.
- **10162**: (a) not in the ranges (10162 is above 10128 and not listed; 10279 is not listed beside 10280/10282); (b) denominator = 733 → meets the rate criterion.
- **10279**: (a) not in the ranges (10162 is above 10128 and not listed; 10279 is not listed beside 10280/10282); (b) denominator = 84 → meets the rate criterion.

## 4. Impact of adding both ZCTAs to Manhattan (HW4 formulas unchanged)

| Area | ZCTAs | Renter hh | Burdened | Rate (HW4) | Rate (with 2) | Δ pts | Severe (HW4) | Severe (with 2) | Δ pts | Rank (1 = highest) |
|---|---|---|---|---|---|---|---|---|---|---|
| Manhattan | 44 → 46 | 553,722 → 554,539 | 265,341 → 265,719 | 47.920% | 47.917% | -0.002 | 25.282% | 25.310% | +0.028 | 6 → 6 |
| Bronx | 25 → 25 | 407,159 → 407,159 | 244,797 → 244,797 | 60.123% | 60.123% | +0.000 | 35.855% | 35.855% | +0.000 | 1 → 1 |
| Brooklyn | 38 → 38 | 678,822 → 678,822 | 344,970 → 344,970 | 50.819% | 50.819% | +0.000 | 28.099% | 28.099% | +0.000 | 5 → 5 |
| Queens | 60 → 60 | 438,739 → 438,739 | 232,211 → 232,211 | 52.927% | 52.927% | +0.000 | 28.061% | 28.061% | +0.000 | 3 → 3 |
| Staten Island | 12 → 12 | 50,477 → 50,477 | 28,658 → 28,658 | 56.774% | 56.774% | +0.000 | 32.064% | 32.064% | +0.000 | 2 → 2 |
| New York City | 179 → 181 | 2,128,919 → 2,129,736 | 1,115,977 → 1,116,355 | 52.420% | 52.418% | -0.002 | 28.936% | 28.942% | +0.006 | — → — |

- Borough order, lowest → highest rate: HW4 `Manhattan < Brooklyn < Queens < Staten Island < Bronx`; with both ZCTAs `Manhattan < Brooklyn < Queens < Staten Island < Bronx` (unchanged).
- Rounded to one decimal as in the HW4 figure, Manhattan's rate goes from 47.9% to 47.9%.
- Citywide median of ZIP rates: 53.68% → 53.66% (179 → 181 ZCTAs).
- HPD pressure-index top 10: identical order.
- Because the index is rank-based and rescaled over all ZCTAs, adding two ZCTAs shifts other ZIPs' index values by up to 0.5 points (median |Δ| 0.18).
- 10162 would have rent-burden rank 110 of 181 and an HPD pressure index of 65.5 (0 HPD units).
- 10279 would have rent-burden rank 181 of 181 and an HPD pressure index of 43.0 (0 HPD units).
