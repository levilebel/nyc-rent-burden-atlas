# Policy simulator cross-check

The policy simulator runs in the browser (`docs/assets/js/sim.js`). Two checks support it:

1. **Baseline check (runs on every page load).** The simulator recomputes the HW4 pressure index from the published integer counts and compares it with the published `pressure_index_hpd` and the HW4 top 10. If they differ, the page shows an error banner instead of silently using different numbers.
   Result at implementation: maximum difference 0.0 index points; top 10 identical, in the same order.

2. **Independent R reference.** `pipeline/simulation_reference.R` re-implements the scenario logic in R, from the raw files (via `build_data.R` with `SKIP_WRITE`, unrounded values). It shares no code with `sim.js` and writes `validation/simulation_reference.json`.

| Scenario | ZIPs targeted | Max. index difference (JS vs R) | Scenario top 10 identical | Implied units identical |
|---|---|---|---|---|
| +25 units / 1,000 renters, 10 highest-pressure ZIPs | 10 | < 0.000001 | yes | yes |
| +50, ZIPs with no recorded HPD units | 22 | < 0.000001 | yes | yes |
| +10, all Bronx ZIPs | 25 | < 0.000001 | yes | yes |

The remaining differences come only from rounding the R reference to 6 decimal places.

How to repeat: run `Rscript pipeline/simulation_reference.R`, serve `docs/` locally, and compare the browser results of `simulate()` (from `assets/js/sim.js`) with the JSON for the same scenarios. A uniform increase to all ZIPs changes no value in either implementation, because a rank-based index is invariant to it.
