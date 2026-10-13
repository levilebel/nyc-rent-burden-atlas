# Guide for external reviewers

This package contains the **NYC Rent Burden Atlas**, a static research dashboard built from a university Statistics assignment ("Homework 4 — Rent Burden in New York City"). The goal of the review is to check statistical correctness, geographic accuracy, transparency, and whether any presentation could mislead.

## What is in the package

| Path | Contents |
|---|---|
| `README.md` | Project structure, how to rebuild and preview, how to extend |
| `DATA_SOURCES.md` | Every data source, table ID, reference year and universe |
| `CHANGELOG.md` | Dated record of every change to data and site |
| `docs/` | The complete website (HTML/CSS/JS) and the processed datasets it loads (`docs/data/*.json`, `*.geojson`) |
| `docs/content/research.json` | Source registry and research-log entries shown on the site |
| `pipeline/build_data.R` | Reproduces the HW4 analysis from the raw files, runs validation checks, writes `docs/data/` |
| `pipeline/verify_outputs.R` | Independent base-R recomputation of every published number (shares no code with the build) |
| `pipeline/review_zip_inclusion.R` | Read-only impact study for ZCTAs 10162 and 10279 |
| `pipeline/review_pressure_index.R` | Read-only diagnostics and sensitivity tests for the HW4 pressure index |
| `pipeline/config.example.R` | Template for the local path to the raw research files |
| `validation/` | Generated reports and CSV extracts (see below) |
| `tools/serve.ps1` | Minimal local static server (Windows PowerShell) |

**Not included:** the raw source files (public Census/HPD downloads, see `DATA_SOURCES.md`), the original R Markdown assignment, other coursework, the machine-specific `pipeline/config.local.R`, and editor settings. No credentials or tokens are used anywhere.

## Reports to read first
1. `validation/validation_report.md`: 16 build checks (duplicates, borough assignment, unassigned ZCTAs, zero denominators, sampling reliability, top-10 reliability, the alternative ranking, excluded ZCTAs, income top-coding, HPD records without postcodes, HW3 cross-check) plus the reproduced borough table.
2. `validation/independent_verification.md`: every check is labelled RECOMPUTE (independent recalculation from raw files), REFERENCE (vs. HW4 figure values or the HW3 file), CONSISTENCY (internal), or INFO (descriptive; not counted). Current result: **60 PASS, 0 FAIL**, including **51/51 independent statistical validations**.
3. `validation/zip_inclusion_review.md`: whether ZCTAs 10162 and 10279 (omitted by the HW4 ZIP ranges) should be included, and the numerical impact.
4. `validation/pressure_index_review.md`: exact definition, diagnostics and 6 sensitivity variants of the custom HW4 "pressure index".

## Key methodology (as implemented)
- **Rent burden rate** = (B25070 brackets 30–34.9% + 35–39.9% + 40–49.9% + 50%+) ÷ (total renter households − "not computed") × 100. **Severe** = 50%+ bracket ÷ the same denominator.
- **Borough/NYC rates** pool counts across ZCTAs (Σ numerators ÷ Σ denominators).
- **Borough assignment**: hand-coded ZIP ranges from HW4 (185 ZCTAs; 179 with computable rates).
- **MOE / reliability** (added for the website): Census approximation formulas for sums and proportions; CV = (MOE/1.645)/estimate. Classes: High ≤ 15%, Moderate 15–30%, Low > 30%.
- **HPD intensity** = counted affordable units in ZIP (postcode match) ÷ rent-burden denominator × 1,000.
- **Pressure index (custom, HW4)** = rank(burden, high→low) + rank(HPD units per 1,000, low→high), min-max rescaled to 0–100; ties use the minimum rank. A second version replaces HPD activity with median income.
- **Income**: B19013 "250,000+" (top-coded) and "-" become NA, exactly as in HW4.

## Decisions intentionally left open (author approval pending)
- **ZCTAs 10162 and 10279** stay excluded, matching HW4. They are documented with an optional inclusion comparison (`docs/data/excluded_zctas.json`; Manhattan −0.002 points). 10162 is Low reliability (CV 33.8%); 10279 is a zero-count estimate (0 of 84, ±33.3 pts).
- **Pressure index:** the HW4 baseline is unchanged. An *exploratory* alternative (CV ≤ 30%, ≥ 1,000 renter households, rental units only) is shown separately, with 8/10 top-10 overlap. Not applied: average-rank ties and renaming the index.
- **Top-coded incomes** are kept as NA, to preserve the HW4 method.

## Suggested review questions
1. Are the rent-burden denominators and bracket definitions appropriate for ACS B25070?
2. Are the MOE approximations and the CV thresholds reasonable? Are the reliability flags applied consistently?
3. Is the ZIP→borough assignment correct, and is the treatment of 10162, 10279 and 10463 (Marble Hill) justified?
4. Is the HPD–rent-burden comparison presented without implying causation? Is the time-frame mismatch disclosed clearly enough?
5. Is the pressure index adequately explained and labelled as a custom, non-official, relative measure?
6. Do the visualisations (scales, colours, sorting, tooltips) represent the data faithfully in both light and dark themes?

## How to run the site
Serve the `docs/` folder over HTTP: `powershell -ExecutionPolicy Bypass -File tools/serve.ps1`, then open http://localhost:8765. You can also use any static server, e.g. `python -m http.server` inside `docs/`. Opening `index.html` directly from disk will not load the data.

Reproducing `docs/data/` requires the raw files listed in `DATA_SOURCES.md`, R ≥ 4.3 with `tidyverse`, `jsonlite`, `sf`, and a `pipeline/config.local.R` pointing to them.
