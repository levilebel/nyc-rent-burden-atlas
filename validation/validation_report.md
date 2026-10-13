# Validation report

Generated 2026-10-12 23:06 EDT by `pipeline/build_data.R`.

| Status | Check | Detail |
|---|---|---|
| PASS | Each ZIP code appears once in the merged dataset | 0 duplicated ZIP codes in 185 rows. |
| NOTE | HW4 borough assignment agrees with HPD's Borough field | ZIP/borough pairs that differ: 10463 (HW4: Bronx; HPD: Manhattan, 5 records). ZIP 10463 contains Marble Hill, which is legally part of Manhattan but on the Bronx mainland; HW4 assigns the whole ZIP to the Bronx. |
| FLAG | NYC ZCTAs omitted by the HW4 ZIP ranges | ZCTAs 10162 (Upper East Side, 746 renter households) and 10279 (Lower Manhattan, 84) are Manhattan ZCTAs with renters that fall outside the HW4 ranges and are therefore excluded. Combined effect on Manhattan: 830 of 579,404 renter households (0.14%). Other unassigned 110xx ZCTAs with renters (11050, 11003, 11021, 11040, 11010, 11096, 11001, 11030, 11023, 11024, 11020) lie mainly in Nassau County and are correctly excluded; the rest have zero renter households. |
| NOTE | ZIP codes without a computable rent-burden rate | 6 of 185 assigned ZCTAs have no renter households for which burden is computed and are excluded from rates: 10020, 11359, 11371, 11424, 11430, 10311. |
| FLAG | Sampling reliability of ZIP-level rent-burden rates | 2 ZIP codes have a coefficient of variation above 30% (approximate MOE computed from B25070 margins of error), flagged 'use with caution' on the site: 10464, 11697. |
| FLAG | Sampling reliability of HW4's top-10 pressure ZIPs | 2 of the 10 ZIPs have CV above 15%: 11005 (84 renter households, 73.8% ± 35.5 pts); 11697 (15 renter households, 66.7% ± 163.0 pts). Rankings of small ZCTAs are sensitive to sampling error. |
| NOTE | Exploratory alternative ranking (not HW4): reliable estimates, rental units only | Universe: 173 of 179 ZCTAs (excluded: CV > 30% or < 1,000 renter households: 10464 (CV > 30% and < 1,000 renter households); 11005 (< 1,000 renter households); 11363 (< 1,000 renter households); 11411 (< 1,000 renter households); 11697 (CV > 30% and < 1,000 renter households); 10307 (< 1,000 renter households)). Activity = HPD rental units per 1,000 renter households. Top 10 overlap with the HW4 baseline: 8/10. Baseline top-10 ZIPs dropped by the criteria: 11005 [< 1,000 renter households], 11697 [CV > 30% and < 1,000 renter households]. |
| NOTE | Excluded Manhattan ZCTAs documented with an optional inclusion comparison | 10162 and 10279 stay outside the HW4 study population. Including both: Manhattan 47.920% → 47.917%, NYC 52.420% → 52.418%; borough order unchanged. |
| FLAG | Median household income values converted to NA | HW4 converts B19013 with as.numeric(), so top-coded values ('250,000+') and suppressed values ('-') become NA. Among ZIPs with valid rent-burden rates, 3 are dropped from the income analysis: 10004 (250,000+), 10007 (250,000+), 10282 (250,000+). The top-coded ZIPs are among the highest-income areas, so their exclusion slightly biases income comparisons. The site reproduces HW4 and labels these ZIPs as '$250,000+'. |
| FLAG | HPD records without a postcode | 1,958 of 9,551 HPD building records (20.5%) have no postcode and carry 3,351 of 320,946 counted affordable units (1.0%). HW4 drops them from the ZIP-level merge, so ZIP-level affordable-unit counts are lower bounds. Borough totals on this site use HPD's Borough field and include these records. |
| NOTE | HPD postcodes not matched to an analysed ZCTA | 1 postcode(s) with 75 counted units do not match a ZCTA in the analysis: 10158. |
| PASS | HPD: All Counted Units = Rental + Homeownership | 0 inconsistent records; 29 records have a missing All Counted Units value. |
| NOTE | HPD: buildings appearing in multiple projects | 2,072 building IDs appear in more than one project (no duplicated project-building rows). HPD counts units per project, so a building rehabilitated/preserved more than once contributes units each time; 'number_of_buildings' in HW4 is therefore a count of project-building records, not distinct buildings. |
| PASS | Brooklyn counts match the independent HW3 calculation | 38 of 38 HW3 Brooklyn ZCTAs matched; 0 mismatches in burdened or valid-renter counts. Brooklyn ZCTAs in HW4 but not HW3: none. |
| PASS | Borough rates reproduce HW4 (pooled counts, not average of ZIP rates) | Manhattan 47.9%; Bronx 60.1%; Brooklyn 50.8%; Queens 52.9%; Staten Island 56.8% |
| PASS | Every analysed ZIP has a boundary polygon | 185 of 185 analysed ZCTAs matched to 2020 cartographic boundaries (plus 2 excluded Manhattan ZCTAs drawn for documentation). |

## Borough summary (reproduced)

| Borough | Renter households (computed) | Rent-burdened | Rate % | Severe % | HPD units (all records) |
|---|---|---|---|---|---|
| Manhattan |   553,722 |   265,341 | 47.9 ± 0.9 | 25.3 ± 0.7 |  74,338 |
| Bronx |   407,159 |   244,797 | 60.1 ± 1.0 | 35.9 ± 0.8 | 106,661 |
| Brooklyn |   678,822 |   344,970 | 50.8 ± 0.7 | 28.1 ± 0.5 |  90,784 |
| Queens |   438,739 |   232,211 | 52.9 ± 0.8 | 28.1 ± 0.6 |  42,952 |
| Staten Island |    50,477 |    28,658 | 56.8 ± 2.4 | 32.1 ± 2.1 |   6,211 |
| New York City | 2,128,919 | 1,115,977 | 52.4 ± 0.4 | 28.9 ± 0.3 | 320,946 |
