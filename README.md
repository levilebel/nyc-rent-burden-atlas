# NYC Rent Burden Atlas

An interactive research dashboard on renter cost burden, household income and affordable housing activity across New York City's five boroughs, with a scenario-based policy simulator.

- **Live site:** https://levilebel.github.io/nyc-rent-burden-atlas/
- **Author:** Levi Lebel ([About](https://levilebel.github.io/nyc-rent-burden-atlas/about.html))

The project began as Statistics coursework (Homework 4, *Rent Burden in New York City*, with HW3 as a Brooklyn cross-check) and has grown into a portfolio project on data analysis, public policy and housing affordability.

## Research question

> How do rent burden, household income and affordable housing activity vary across New York City's boroughs and ZIP codes, and where does high rent burden coincide with low affordable housing activity?

Sub-questions, as reflected in the analysis:
1. How does the share of rent-burdened renter households vary across boroughs and ZIP codes?
2. How is median household income associated with rent burden?
3. How does recorded affordable housing activity (HPD units per 1,000 renter households) line up with rent burden?
4. Which ZIP codes combine high burden with low activity (the HW4 affordability pressure index), and how would that ranking respond to hypothetical increases in activity?

## Datasets

| Dataset | Reference period | Used for |
|---|---|---|
| U.S. Census Bureau, ACS 5-year estimates, **Table B25070** (gross rent as % of household income), ZCTA level | 2024 release, survey years 2020–2024 | Rent burden (≥30%) and severe burden (≥50%), renter households, 90% margins of error |
| U.S. Census Bureau, ACS 5-year estimates, **Table B19013** (median household income) | 2020–2024, 2024 dollars | Income analysis, income-based pressure index |
| NYC HPD, **Affordable Housing Production by Building** (NYC Open Data) | Export 2026-10-12; projects started 2014 – mid-2026 | Counted affordable units (new construction and preservation, rental and homeownership) |
| Census **2020 ZCTA** cartographic boundaries (1:500k) | 2020 | Maps |

Full details, table IDs and universes: [`DATA_SOURCES.md`](DATA_SOURCES.md). Raw source files are **not** in this repository. The pipeline reads them read-only from the author's original coursework folder.

## Methodology (summary)

- **Rent burden rate** = renter households paying ≥30% of income on gross rent ÷ renter households for which the ratio is computed. Severe burden uses ≥50%. Borough and city rates pool counts across ZIP codes.
- **Uncertainty:** approximate 90% margins of error and coefficients of variation, using the Census Bureau's ACS formulas. Reliability: CV ≤ 15% High, 15–30% Moderate, > 30% Low.
- **Affordable housing activity** = HPD counted units per 1,000 renter households, matched on postcode.
- **Affordability pressure index (HW4, custom):** rank of burden (high→low) + rank of activity (low→high), rescaled to 0–100. It is a relative ranking among NYC ZIP codes, not an official statistic and not a causal measure. An exploratory alternative (reliable estimates only, rental units only) is shown alongside, without replacing it.
- **Policy simulator:** see below.

The full methodology, validation results and limitations are on the site's Methodology section and in [`validation/`](validation/).

## Descriptive analysis vs. the policy simulator

Most of the site is **descriptive**. It reports what the data show: where burden is high, how it relates to income, and where recorded affordable housing activity is low.

The **Policy Simulator** adds a **prescriptive, scenario-based** component. A user chooses a hypothetical increase in affordable housing activity (e.g. +10, +25 or +50 units per 1,000 renter households) and a group of ZIP codes to receive it. The HW4 pressure index is then recalculated with the same formula, and the site shows current vs. scenario maps, a change map and summary tables.

What the simulation is and is not:
- It **is** an illustration of how the pressure ranking responds to a hypothetical change in recorded activity, holding everything else fixed.
- It is **not** a forecast. Rent burden, incomes and rents are held constant because the data cannot identify the causal effect of new units on burden.
- Because the index is relative, improving some ZIP codes moves others up the ranking, and a uniform increase everywhere changes nothing. The change map makes this visible.
- The engine (`docs/assets/js/sim.js`) recomputes the index from the published counts, checks on every load that it reproduces the published HW4 index exactly, and has been cross-checked against an independent R implementation ([`validation/simulation_crosscheck.md`](validation/simulation_crosscheck.md)).

## Current limitations

- **Survey estimates:** ACS figures are 2020–2024 five-year estimates with sampling error. Small ZIP codes can be unreliable (they are flagged ⚠ throughout).
- **Different time frames:** HPD activity (projects started 2014 – mid-2026) and burden (2020–2024) cover different periods. Units completed after a household was surveyed cannot have affected its burden.
- **Geography:** Census ZCTAs approximate USPS ZIP codes. Two small Manhattan ZCTAs (10162, 10279) are outside the HW4 ZIP ranges and are documented separately. ZIP 10463 includes Marble Hill (legally Manhattan), which HW4 counts in the Bronx.
- **HPD scope:** counted units mix new construction with preservation, and rental with homeownership units.
- **Index design:** rank-based and relative. 22 ZIP codes with no recorded HPD units tie at the lowest activity rank. Top-coded incomes ($250,000+) are excluded from income comparisons, as in HW4.
- **Simulation:** illustrative only, with no causal model. "Hypothetical additional units" is a size reference, not a cost or feasibility estimate.
- **Policy context:** placeholders only until verified entries are added.

## Future development

- Integrate future coursework (e.g. Homework 5+) as new, separately validated modules. Earlier results are kept unchanged.
- Fill the Policy Context section with verified federal, state and city policies, programs and grants (`docs/content/policy.json`).
- Pending author decisions: whether to include ZCTAs 10162/10279, and refinements to the HW4 index (average-rank ties, a descriptive name).
- Possible extensions: additional ACS years for change over time, and a scenario model that uses an explicit, sourced assumption about how new units relate to burden (clearly separated from the current illustrative tool).

## Project structure

```
nyc-rent-burden/
├── docs/                        ← website root (GitHub Pages "docs/" folder)
│   ├── index.html               ← main dashboard (single page, all sections)
│   ├── about.html               ← About page
│   ├── assets/css/styles.css    ← all styles; colours are light/dark theme tokens
│   ├── assets/js/
│   │   ├── boot.js              ← entry: checks that D3 loaded, then imports app.js
│   │   ├── app.js               ← loads data, initialises sections, shared state
│   │   ├── site.js              ← theme toggle + navigation (shared with about.html)
│   │   ├── about.js             ← About page (figures read from data)
│   │   ├── util.js              ← METRICS registry (labels/units/sources), palettes, formatting, tooltip
│   │   ├── charts.js            ← reusable D3 components (bars, stacks, strip, scatter, columns, choropleth)
│   │   ├── sim.js               ← policy simulation engine (pure functions, no DOM)
│   │   └── sections/*.js        ← one module per page section (overview, boroughs, zips, income,
│   │                              housing, simulator, policy, methods, research)
│   ├── content/research.json    ← data-source registry + research-log entries
│   ├── content/policy.json      ← policy context (author-curated; entries need a source + date)
│   └── data/                    ← GENERATED by the pipeline — do not edit by hand
├── pipeline/
│   ├── build_data.R             ← reproduces HW4 from raw files, validates, writes docs/data/
│   ├── verify_outputs.R         ← independent base-R recheck of every published number
│   ├── review_zip_inclusion.R   ← read-only impact study: ZCTAs 10162 / 10279
│   ├── review_pressure_index.R  ← read-only diagnostics + sensitivity of the HW4 index
│   ├── simulation_reference.R   ← independent R reference for the policy simulator
│   ├── config.example.R         ← template for machine-specific paths
│   └── config.local.R           ← (git-ignored) path to the raw coursework files
├── validation/                  ← reports and CSV extracts (regenerated by the scripts)
├── tools/serve.ps1              ← local static server (PowerShell; no Node/Python needed)
├── DATA_SOURCES.md · REVIEW_GUIDE.md · CHANGELOG.md
```

The original research files are **read-only inputs**. The pipeline never writes to them.

## Rebuild the data

```bash
Rscript pipeline/build_data.R
```

Then run `Rscript pipeline/verify_outputs.R`. It exits non-zero if any published value disagrees with the raw files. Each check is labelled
**RECOMPUTE** (independent recalculation from raw files), **REFERENCE** (vs. HW4 figure values / HW3 file), **CONSISTENCY** (internal), or **INFO** (descriptive, never counted as a pass).
After any change to the build, also rerun `review_zip_inclusion.R`, `review_pressure_index.R` and `simulation_reference.R` so the reports in `validation/` stay current.

Requires R ≥ 4.3 with `tidyverse`, `jsonlite` and `sf`. ZCTA boundaries come from the local `tigris` cache (`cb_2020_us_zcta520_500k`).

### Baseline vs. additions
The HW4 baseline lives in `borough_summary.json`, `statistics.json`, `hpd_by_year.json` and the original fields of `zip_data.json`. Website-only analyses are kept separate so the baseline stays traceable:
- `alternative_ranking.json` and the `*_alt` fields of `zip_data.json` hold the exploratory ranking.
- `excluded_zctas.json` holds the 10162/10279 comparison.
- The policy simulator computes its scenarios in the browser from the published counts and creates no new data files.

Never change an HW4 field to implement a variant; add a new field or file instead.

## Preview locally

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8765
```

Then open http://localhost:8765/. Opening `index.html` directly from disk will not work, because browsers block `fetch()` on `file://`.

## External dependencies
- **D3 7.9.0** from `cdn.jsdelivr.net`, with `unpkg.com` as an automatic fallback (`index.html`). `assets/js/boot.js` shows a clear message if neither loads. The text stays readable, but the charts won't work.
- **Google Fonts** (Inter, Source Serif 4), with system fonts as the fallback.
- No other runtime services; all data are static files in `docs/data/`.

## Themes

Light and dark themes share one set of components. CSS colours are tokens in `styles.css` (`:root` and `:root[data-theme="dark"]`). Chart mark colours are in `THEMES` in `util.js`. Charts must take colours from `COLORS` / `seq()` at draw time and register with `onResize` (or `onTheme` for legends), so a theme switch can redraw them.

## Adding a new assignment (e.g. Homework 5)

1. **Inspect** the new assignment folder: code, raw data, outputs.
2. **Extend the pipeline** with a new clearly delimited section, or a new script `pipeline/build_hw5.R`. It should read raw files from their original location, reproduce the assignment's calculations, add checks with `add_check()`, and write to new files in `docs/data/` (e.g. `hw5_*.json`). Do not overwrite existing outputs.
3. **Register** the data source(s) and a new module entry in `docs/content/research.json`.
4. **Add UI**: new metrics go in `METRICS` (`util.js`), and a new section goes in `docs/assets/js/sections/<name>.js`, with markup in `index.html`, an entry in `SECTIONS` (`app.js`) and, if needed, a nav link.
5. **Record** the change in `CHANGELOG.md`.

Only datasets that are actually comparable should be merged. For example, a different ACS vintage or geography needs its own section rather than being mixed into the 2024 ZCTA tables.

## Adding policy context

Edit `docs/content/policy.json`. Each entry needs `name`, `level`, `type`, `summary`, `relevance`, `source_name`, `source_url` and `verified_on` (YYYY-MM-DD). Entries without a source URL and verification date are not displayed. Use official sources (statute text, agency or program pages).

## Publishing

- **Repository:** https://github.com/levilebel/nyc-rent-burden-atlas (GitHub Pages: branch `main`, folder `/docs`)

Every push to `main` redeploys the site automatically, usually within a minute.
Raw ACS/HPD downloads, `.Rproj` files, assignment documents and `pipeline/config.local.R` are **not** in the repository (see `.gitignore`).

### Update workflow
1. Add or change the analysis (see "Adding a new assignment" above).
2. `Rscript pipeline/build_data.R`, then `Rscript pipeline/verify_outputs.R` (must report 0 FAIL).
3. Preview locally (`tools/serve.ps1`) and check both themes.
4. Record the change in `CHANGELOG.md`.
5. Commit and `git push`. The Pages deployment then runs on its own.
