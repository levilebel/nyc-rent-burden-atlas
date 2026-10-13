# Data sources and reference years

All website data are derived from the sources below by `pipeline/build_data.R`. The raw source files are **not** part of this repository; the table IDs and export dates identify them.

| # | Dataset | Publisher | Identifier | Reference period | Geography | Universe | Used for |
|---|---|---|---|---|---|---|---|
| 1 | Gross Rent as a Percentage of Household Income in the Past 12 Months | U.S. Census Bureau, American Community Survey | Table **B25070**, file `ACSDT5Y2024.B25070-Data.csv` | **2024 ACS 5-Year Estimates** (pooled survey years 2020–2024) | ZIP Code Tabulation Areas (ZCTA5) | Renter-occupied housing units | Rent burden (≥30%) and severe burden (≥50%) rates; renter household counts; 90% margins of error |
| 2 | Median Household Income in the Past 12 Months (in 2024 inflation-adjusted dollars) | U.S. Census Bureau, American Community Survey | Table **B19013**, file `ACSDT5Y2024.B19013-Data.csv` | **2024 ACS 5-Year Estimates** (2020–2024), dollars in 2024 terms | ZCTA5 | Households | Median household income by ZIP; income-based pressure index |
| 3 | Affordable Housing Production by Building | NYC Department of Housing Preservation and Development (HPD), via NYC Open Data | File `Affordable_Housing_Production_by_Building_20261012.csv` | **Export dated 2026-10-12**; project start dates 2014-01-03 to 2026-06-30 (2026 is partial) | Building records with borough and postcode | Buildings in projects counted toward the City's affordable housing plans | Counted affordable units (new construction and preservation, by income band and year), by ZIP and borough |
| 4 | 2020 Cartographic Boundary File, ZCTA5, 1:500,000 | U.S. Census Bureau (retrieved with the R package `tigris`) | `cb_2020_us_zcta520_500k` | **2020** boundaries | ZCTA polygons | — | Map geometry (simplified for the web) |

Cross-check only (not displayed): HW3 Brooklyn analysis (`derived_rent_burden_by_zip.csv`), built from the same ACS table B25070. Its HPD download was accessed 2026-09-26 (HW3 source log).

## Notes on comparability
- ACS 5-year estimates describe the pooled period 2020–2024, not a single year.
- HPD production (2014–mid-2026, a flow of policy activity) and ACS rent burden (2020–2024, a household condition) cover different periods and populations. The site compares them descriptively only.
- ZCTAs approximate, but are not identical to, USPS ZIP codes. HPD records are matched on their 5-digit postcode.
