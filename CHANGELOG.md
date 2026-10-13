# Changelog

All changes to the published data and analyses are recorded here. Earlier analyses are kept, not overwritten.

## 2026-10-13 — v0.4.0 professor feedback (published)

**No data or statistical method changed.** `docs/data/` is untouched, and the HW4 baseline and all published values are identical.
- **About page** (`docs/about.html`, `assets/js/about.js`): creator introduction, motivation, research question, datasets, coursework-to-portfolio history, analytical interests. Headline figures are read from the data.
- **Policy simulator** (`assets/js/sim.js`, `sections/simulator.js`): hypothetical +10 / +25 / +50 / custom units per 1,000 renter households for a chosen ZIP group. It recomputes the HW4 index in the browser with the same formula, and shows current vs. scenario maps, a change map, pressure ranks and summary tables. It is labelled as an illustrative simulation, not a causal forecast. The baseline self-check on load matches the published index exactly, and the results match an independent R implementation (`pipeline/simulation_reference.R`, `validation/simulation_crosscheck.md`).
- **Policy context** (`content/policy.json`, `sections/policy.js`): structured placeholders for federal, state, city and grant entries. Only entries with a source URL and verification date are displayed. No policy content has been added.
- **Navigation:** Home · Rent Burden · Income · Affordable Housing · Affordability Pressure · Policy Simulator · About. The income scatter moved into a new **Income** section (with its own borough filter and a borough association table from `statistics.json`), and the rankings card moved into a new **Affordability Pressure** section. Their content is unchanged. Methodology, research log and GitHub links are in the footer. Theme and navigation code is now shared in `assets/js/site.js`, and scroll-spy supports multi-section nav items.
- **README** rewritten: research question, datasets, methodology, descriptive vs. simulation, limitations, future development.
- Shared `choropleth()` and `rewindFC()` components in `charts.js`; diverging change-map palette (blue = falls, orange = rises) in `util.js`.

## 2026-10-12 — published
- Published to GitHub Pages: https://levilebel.github.io/nyc-rent-burden-atlas/ (repository `levilebel/nyc-rent-burden-atlas`, branch `main`, folder `/docs`). Before publishing: 60/60 verification checks passed and the staged files were scanned for credentials and personal data. Commits use the GitHub no-reply address.

## 2026-10-12 — v0.3.0 external-review improvements

**HW4 baseline unchanged.** `borough_summary.json`, `statistics.json` and `hpd_by_year.json` are byte-identical to v0.2.1. Every HW4 field in `zip_data.json` is unchanged. The HW4 pressure index, its formula, the study population (179/185 ZCTAs) and the "$250,000+" handling are all preserved.

**Correction (website addition, not HW4):** reliability classes are now computed from the *unrounded* CV. Rounding first had labelled ZIP 10307 (CV 15.002%) as High instead of Moderate. Found by the strengthened verification; no other ZIP changed class.

**New, clearly separated analyses**
- *Exploratory alternative ranking* (`alternative_ranking.json`; new `zip_data` fields `pressure_index_alt`, `idx_alt_*`, `alt_exclusion`, `affordable_rental_units_per_1000`, `top10_alt`). It uses the HW4 formula, restricted to CV ≤ 30% and ≥ 1,000 renter households (173 of 179 ZCTAs) and HPD *rental* units only. Its top 10 overlaps the HW4 top 10 by 8/10: 11005 and 11697 drop out; 11429 and 11416 enter.
- *Excluded Manhattan ZCTAs* (`excluded_zctas.json`). 10162 and 10279 are documented with an optional inclusion comparison (Manhattan −0.002 pts; borough order unchanged). They are drawn on the map with a cross-hatch, can't be selected, and stay out of all totals and rankings.

**Verification audit** (`pipeline/verify_outputs.R`)
- Every check is now labelled RECOMPUTE, REFERENCE, CONSISTENCY or INFO. INFO lines are no longer counted as passes; the previous "44/44" included two automatically-true lines.
- New: recomputation of 90% MOEs, CVs and reliability classes from the raw MOE columns; borough MOEs; rental/homeownership units; the alternative ranking; the excluded-ZCTA statistics. HW4 reference checks now cover both HW4 top-10 figures, and the HW3 cross-check is included.
- Reference checks compare unrounded values rounded once, as HW4 did. Comparing the site's 2-dp values was a double-rounding artifact for 11364.
- Result: **60 PASS, 0 FAIL** (RECOMPUTE 47, REFERENCE 4, CONSISTENCY 9). Independent statistical validations: 51/51. INFO lines: 3, not counted.

**Site**
- Rankings card has three tabs: HW4 baseline, exploratory alternative, most HPD activity. A visible caption under each bar shows renter households, burden with its 90% MOE, and reliability, with ⚠ for Low reliability or < 1,000 renter households. Captions wrap on narrow screens. A table explains how the alternative changes each top-10 position. Ranking tabs support arrow keys, Home and End.
- Every ± is labelled as a 90% MOE. "(est.)" marks ACS survey estimates and "(count)" marks HPD administrative counts. The ACS handbook is cited for the MOE/CV formulas.
- New "Reading these data" panel: periods, HPD scope, ZIP vs ZCTA, estimates vs counts, no causation. Marble Hill / ZIP 10463 is explained in the tooltip, detail panel, borough section and methodology.
- Theme button: the accessible name now states the action ("Switch to dark/light mode"); `aria-pressed` removed.
- D3 loads from jsDelivr with an unpkg fallback (`boot.js`). If both fail, a clear message appears and the text stays readable.

## 2026-10-12 — review package (not published)
- Added `DATA_SOURCES.md` (all sources, table IDs, reference years, universes) and `REVIEW_GUIDE.md` (guide for external reviewers).
- Created `NYC_Rent_Burden_Review.zip` (38 files) on the Desktop for an external review. No data or calculations changed.

## 2026-10-12 — v0.2.1 (not published)

Display only: no data, formulas or interactions changed. The data files are untouched and the independent verification still passes 44/44.
- Rent-burden tooltips in the borough comparison and the ZIP explorer (map, dot strip, scatter, comparison) now add the **90% margin of error** and a **reliability class**. The class uses the existing CV rule: High ≤ 15%, Moderate 15–30%, Low > 30%.
- Low-reliability estimates show a text warning: "⚠ High statistical uncertainty". The warning uses an icon and text, not colour alone.
- The ZIP detail panel adds MOE and reliability rows, plus the warning box for low-reliability ZIPs.
- The ZIP table and the borough summary table gain a sortable "Reliability" column. Borough reliability applies the same CV rule to the pooled rate and its MOE; all five boroughs are High.

## 2026-10-12 — v0.2.0 (not published)

**Data: no published value changed.** HW4 methodology is preserved, including the "$250,000+" income treatment (NA, as in HW4).
- New `pipeline/verify_outputs.R`: an independent base-R recomputation of every published number from the raw files. 44/44 checks pass.
- New `pipeline/review_zip_inclusion.R` and `validation/zip_inclusion_review.md`: a review of ZCTAs 10162 and 10279. **Not applied.** The dashboard still matches HW4 while you decide.
- New `pipeline/review_pressure_index.R` and `validation/pressure_index_review.md`: the definition, diagnostics and six sensitivity variants. **The calculation is not changed.**
- `zip_data.json` gains the pressure-index component ranks (`idx_*` fields) for transparency. All existing fields are unchanged; the borough, statistics and year files are byte-identical.
- `build_data.R`: `SKIP_WRITE` guard so the review scripts can reuse the exact HW4 logic without writing outputs.

**Site**
- Dark mode: a sun/moon toggle in the header. It follows the OS theme until the visitor chooses, saves the choice in localStorage, applies it before first paint (no flash), uses a short colour transition (off under reduced motion), and re-draws every chart with a dark palette from the same blue ramp.
- The pressure index is labelled everywhere as a custom HW4 research index, not an official statistic and not causal. Tooltips and the ZIP panel show its component ranks. The methodology section adds the review findings.
- Fixes: the comparison caption no longer mentions "whiskers" (MOE is in the tooltip); the light-mode income-band ramp is re-stepped so every band is ≥2:1 against the card; there are now loading, empty and error states.

## 2026-10-12 — v0.1.0 (first version, not published)

**Data**
- `pipeline/build_data.R` reproduces the HW4 pipeline (`rent_burden_nyc_analysis.Rmd`) from the raw files:
  ACS 2024 5-year B25070 and B19013 (ZCTA), and NYC HPD Affordable Housing Production by Building (export 2026-10-12).
- Verified against HW4 outputs: the borough rates (Manhattan 47.9%, Brooklyn 50.8%, Queens 52.9%, Staten Island 56.8%, Bronx 60.1%) and the top-10 pressure list both match the saved figures.
- Cross-checked against HW3: all 38 Brooklyn ZCTAs match exactly.
- Added for the website (not in HW4): approximate 90% MOEs and CVs for rent-burden rates; borough HPD totals that include records without a postcode; new-construction/preservation and income-band splits; HPD units by project start year; Pearson/OLS income association by borough.
- Validation flags recorded in `validation/validation_report.md`:
  - ZCTAs 10162 and 10279 are omitted by the HW4 ZIP ranges.
  - Top-coded incomes become NA.
  - 20.5% of HPD records have no postcode.
  - Small samples among the top-10 pressure ZIPs (11005, 11697).
  - None of these changes the HW4 numbers; they are documented, not "fixed".

**Site**
- Sections: Overview, Borough comparison, ZIP explorer (map, search, comparison, scatter, table), Affordable housing, Methodology (with live validation results), Research log.
