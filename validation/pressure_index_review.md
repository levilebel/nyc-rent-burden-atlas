# Review: HW4 Affordability Pressure Index (rent burden + HPD activity)

Generated 2026-10-12 22:40 by `pipeline/review_pressure_index.R`. **Diagnostics only — the published index is unchanged.**

## 1. Exact definition (from HW4 Rmd, reproduced in build_data.R)

1. Universe: the 179 ZCTAs with `rent_burden_denominator > 0`.
2. `rent_burden_rank = min_rank(desc(rent_burden_rate))`: 1 = highest burden.
3. `low_affordable_rank = min_rank(affordable_units_per_1000)`: 1 = fewest HPD units per 1,000 renter households.
4. `priority_score = rent_burden_rank + low_affordable_rank`: equal implicit weights, on the rank scale.
5. `index = 100 × (max(score) − score) / (max(score) − min(score))`: min–max rescaled to 0–100, 100 = most pressured.

Properties: ordinal only (magnitudes discarded); relative to the set of ZCTAs (adding/removing ZCTAs changes every value); ties use the minimum rank; no adjustment for sampling error; components are a 2020–2024 household condition and a 2014–2026 policy flow.

## 2. Diagnostics

- **Ties at zero activity:** 22 of 179 ZCTAs have 0 HPD units and all receive `low_affordable_rank = 1`. The next ZCTA receives rank 23. Being a zero-activity ZIP therefore guarantees the best possible activity rank, and these 22 ZIPs make up 9 of the top 10.
- **Which component drives the index?** Spearman correlation of the index with the burden rank: 0.65; with the low-activity rank: 0.68.
- **Size and reliability:** Spearman correlation between the index and renter households: -0.37. Among the top 10, the smallest ZCTAs are 11697 (   15 renter hh, ±163.0 pts), 11005 (   84 renter hh, ±35.5 pts), 11428 (1,474 renter hh, ±14.1 pts).
- **Production denominator mixes tenure:** units per 1,000 *renter* households include 58,353 homeownership units citywide (18.4% of ZIP-matched counted units).
- **Causality:** the index combines a condition (burden) with a policy flow (production). A high score means *high burden and comparatively little recorded HPD activity*. It does **not** show that low production caused high burden, or that more production would lower it.

## 3. Sensitivity of the top 10 (published order: 11005, 11428, 11697, 10309, 10312, 11356, 11364, 10308, 11414, 11354)

| Variant | Top 10 | Overlap with published | Spearman ρ with published index |
|---|---|---|---|
| Average ranks for ties (instead of minimum) | 11005, 11428, 11697, 10309, 10312, 11356, 11364, 11354, 10308, 11416 | 9/10 | 1.00 |
| Exclude CV > 30% (n = 177) | 11005, 11428, 10309, 10312, 11356, 11364, 10308, 11414, 11354, 11416 | 9/10 | 1.00 |
| Exclude ZCTAs with < 1,000 renter hh (n = 173) | 11428, 10309, 10312, 11356, 11364, 10308, 11354, 11414, 11416, 11419 | 8/10 | 1.00 |
| Rental units only (exclude homeownership) | 11005, 11428, 11697, 10309, 11411, 10312, 11356, 11364, 10308, 11429 | 8/10 | 0.96 |
| Burden weighted 2:1 over activity | 11005, 11428, 11697, 10309, 10312, 11354, 10302, 11356, 11419, 11364 | 8/10 | 0.92 |
| Standardised values (z-scores) instead of ranks | 11005, 11428, 11697, 10302, 10309, 11354, 11363, 10312, 11356, 11416 | 7/10 | 0.97 |

## 4. Recommendations (require approval before any change)

1. **Label** it everywhere as a *custom research index from Homework 4*, not an official statistic. Show both component ranks in tooltips. *(Wording only. Implemented, since it does not change any value.)*
2. **Reliability screen:** exclude or visually de-emphasise ZCTAs with CV > 30% (or < 1,000 renter households) from the ranking. See section 3 for the effect on the top 10.
3. **Tie handling:** use average ranks so the 22 zero-activity ZIPs do not all receive the extreme rank of 1.
4. **Tenure consistency:** rank on HPD *rental* units per 1,000 renter households, so the numerator and denominator refer to the same population.
5. **Rename** to something descriptive and non-causal, e.g. *“Burden–production gap rank”*. “Pressure” can be read as a measure of need or causation.
6. Keep the index **relative**: present it as a ranking or percentile, not as a 0–100 level that could be compared across datasets or years.
