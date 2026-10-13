# ============================================================
# Review: should ZCTAs 10162 and 10279 be included in Manhattan?
#
# Read-only impact analysis. Does NOT change dashboard data.
# Reuses the exact HW4 logic from build_data.R (sourced with SKIP_WRITE).
# Output: validation/zip_inclusion_review.md (+ CSV)
#
#   Rscript pipeline/review_zip_inclusion.R
# ============================================================

SKIP_WRITE <- TRUE
source("pipeline/build_data.R")

CANDIDATES <- c("10162", "10279")
out <- character()
say <- function(...) out <<- c(out, sprintf(...))

# ------------------------------------------------------------
# 1. Presence and values in the original B25070 file
# ------------------------------------------------------------
raw_rows <- rent_raw %>% mutate(zipcode = str_extract(NAME, "\\d{5}")) %>% filter(zipcode %in% CANDIDATES)
cand <- rent_all %>% filter(zipcode %in% CANDIDATES) %>%
  mutate(rent_burdened_households = rent_30_34 + rent_35_39 + rent_40_49 + rent_50_plus,
         rent_burden_denominator = total_renter_households - not_computed,
         rent_burden_rate = rent_burdened_households / rent_burden_denominator * 100,
         severe_rent_burden_rate = rent_50_plus / rent_burden_denominator * 100,
         moe_burdened = sqrt(moe_30_34^2 + moe_35_39^2 + moe_40_49^2 + moe_50_plus^2),
         moe_denominator = sqrt(total_moe^2 + moe_not_computed^2),
         rent_burden_rate_moe = prop_moe(rent_burdened_households, moe_burdened, rent_burden_denominator, moe_denominator),
         severe_rent_burden_rate_moe = prop_moe(rent_50_plus, moe_50_plus, rent_burden_denominator, moe_denominator),
         rent_burden_rate_cv = (rent_burden_rate_moe / Z90) / rent_burden_rate * 100,
         hw4_rule_borough = hw4_borough(zipcode))

# Raw strings, to detect suppression symbols ("-", "*****", "N")
raw_cells <- raw_rows %>% select(NAME, matches("^B25070_0(01|07|08|09|10|11)[EM]$"))
suppressed <- raw_cells %>% select(-NAME) %>% mutate(across(everything(), ~ is.na(suppressWarnings(as.numeric(.x))))) %>%
  summarise(across(everything(), any)) %>% unlist()

inc <- income_raw %>% mutate(zipcode = str_extract(NAME, "\\d{5}")) %>% filter(zipcode %in% CANDIDATES) %>%
  select(zipcode, B19013_001E, B19013_001M)
hpd_pc <- housing_all %>% filter(zipcode %in% CANDIDATES) %>% count(zipcode, Borough)

# ------------------------------------------------------------
# 2. Geographic verification (independent of HW4's ZIP ranges)
# ------------------------------------------------------------
zall <- st_read(ZCTA_SHP, quiet = TRUE) %>% st_transform(2263)
nyc_z <- zall %>% filter(ZCTA5CE20 %in% c(analysis$zipcode, CANDIDATES)) %>%
  mutate(borough = as.character(analysis$borough[match(ZCTA5CE20, analysis$zipcode)]))
cz <- nyc_z %>% filter(ZCTA5CE20 %in% CANDIDATES)
others <- nyc_z %>% filter(!ZCTA5CE20 %in% CANDIDATES)

geo <- map_dfr(seq_len(nrow(cz)), function(i) {
  p <- cz[i, ]
  touch <- others[lengths(st_is_within_distance(others, p, dist = 100)) > 0, ] # 100 ft tolerance
  cen <- st_centroid(st_geometry(p)) %>% st_transform(4326) %>% st_coordinates()
  tibble(zipcode = p$ZCTA5CE20,
         area_acres = as.numeric(st_area(p)) / 43560,
         centroid_lon = cen[1], centroid_lat = cen[2],
         neighbours = paste(sprintf("%s (%s)", touch$ZCTA5CE20, touch$borough), collapse = ", "),
         neighbour_boroughs = paste(unique(touch$borough), collapse = "/"))
})

# HPD building coordinates as an independent geographic check of borough labels:
# which borough do HPD buildings physically located in each ZCTA report?
pts <- housing_all %>% filter(!is.na(Latitude), !is.na(Longitude)) %>%
  st_as_sf(coords = c("Longitude", "Latitude"), crs = 4326) %>% st_transform(2263)
joined <- st_join(pts, nyc_z %>% select(ZCTA5CE20, zcta_borough = borough), join = st_within) %>%
  st_drop_geometry() %>% filter(!is.na(ZCTA5CE20))
spatial_boro <- joined %>% count(ZCTA5CE20, zcta_borough, Borough) %>%
  group_by(ZCTA5CE20) %>% mutate(share = n / sum(n)) %>% ungroup()
spatial_conflicts <- spatial_boro %>% filter(!is.na(zcta_borough), Borough != zcta_borough)
zctas_tested <- n_distinct(spatial_boro$ZCTA5CE20[!is.na(spatial_boro$zcta_borough)])
cand_pts <- spatial_boro %>% filter(ZCTA5CE20 %in% CANDIDATES)

# ------------------------------------------------------------
# 3. Impact: recompute HW4 outputs with the two ZCTAs added to Manhattan
# ------------------------------------------------------------
add_rows <- cand %>%
  filter(rent_burden_denominator > 0) %>%
  transmute(zipcode, borough = factor("Manhattan", levels = BOROUGHS),
            total_renter_households, rent_burden_denominator, rent_burdened_households,
            severely_rent_burdened_households = rent_50_plus, rent_burden_rate, severe_rent_burden_rate,
            moe_burdened, moe_50_plus, moe_denominator, rent_burden_rate_moe)
alt <- bind_rows(analysis %>% select(names(add_rows)), add_rows)

boro_base <- analysis %>% group_by(borough) %>% summarise_burden() %>% mutate(borough = as.character(borough))
boro_alt <- alt %>% group_by(borough) %>% summarise_burden() %>% mutate(borough = as.character(borough))
nyc_base <- analysis %>% summarise_burden() %>% mutate(borough = "New York City")
nyc_alt <- alt %>% summarise_burden() %>% mutate(borough = "New York City")
cmp <- bind_rows(boro_base, nyc_base) %>%
  select(borough, zips_base = zip_count_valid, renters_base = renter_households, burdened_base = rent_burdened_households,
         rate_base = rent_burden_rate, severe_base = severe_rent_burden_rate, moe_base = rent_burden_rate_moe) %>%
  left_join(bind_rows(boro_alt, nyc_alt) %>%
              select(borough, zips_alt = zip_count_valid, renters_alt = renter_households, burdened_alt = rent_burdened_households,
                     rate_alt = rent_burden_rate, severe_alt = severe_rent_burden_rate), by = "borough") %>%
  mutate(rate_diff_pts = rate_alt - rate_base, severe_diff_pts = severe_alt - severe_base,
         rank_base = rank(-rate_base), rank_alt = rank(-rate_alt))
order_base <- boro_base %>% arrange(rent_burden_rate) %>% pull(borough)
order_alt <- boro_alt %>% arrange(rent_burden_rate) %>% pull(borough)

# ZIP-level medians and the HPD pressure index ranking, recomputed with the extra ZCTAs
alt_full <- alt %>% left_join(housing_zip %>% select(zipcode, affordable_units), by = "zipcode") %>%
  mutate(affordable_units = replace_na(affordable_units, 0),
         affordable_units_per_1000 = affordable_units / rent_burden_denominator * 1000) %>%
  filter(rent_burden_denominator > 0)
alt_idx <- alt_full %>% mutate(rb = min_rank(desc(rent_burden_rate)), la = min_rank(affordable_units_per_1000),
                               score = rb + la, idx = 100 * (max(score) - score) / (max(score) - min(score)))
top10_alt <- alt_idx %>% arrange(score) %>% slice_head(n = 10) %>% pull(zipcode)
idx_shift <- alt_idx %>% select(zipcode, idx) %>% inner_join(analysis %>% select(zipcode, pressure_index_hpd), by = "zipcode") %>%
  mutate(d = idx - pressure_index_hpd)
med_base <- median(analysis$rent_burden_rate[analysis$valid])
med_alt <- median(alt_full$rent_burden_rate)

# ------------------------------------------------------------
# 4. Report
# ------------------------------------------------------------
f1 <- function(x) formatC(x, format = "f", digits = 1)
f2 <- function(x) formatC(x, format = "f", digits = 2)
f3 <- function(x) formatC(x, format = "f", digits = 3)
n0 <- function(x) format(round(x), big.mark = ",", trim = TRUE)

say("# Review: ZCTAs 10162 and 10279")
say("")
say("Generated %s by `pipeline/review_zip_inclusion.R`. **Read-only analysis — dashboard data unchanged.**", format(Sys.time(), "%Y-%m-%d %H:%M"))
say("")
say("## 1. Presence in the original ACS 2024 B25070 file")
say("")
say("| ZCTA | NAME in file | Total renter hh (±MOE) | Not computed | Denominator | Burdened (≥30%%) | Severe (≥50%%) | Any suppressed cell? | HW4 range assigns |")
say("|---|---|---|---|---|---|---|---|---|")
for (i in seq_len(nrow(cand))) with(cand[i, ], say("| %s | %s | %s (±%s) | %s | %s | %s | %s | %s | %s |",
  zipcode, raw_rows$NAME[raw_rows$zipcode == zipcode], n0(total_renter_households), n0(total_moe), n0(not_computed),
  n0(rent_burden_denominator), n0(rent_burdened_households), n0(rent_50_plus),
  if (any(suppressed)) "yes" else "no", ifelse(is.na(hw4_rule_borough), "— (excluded)", hw4_rule_borough)))
say("")
say("| ZCTA | Rent burden rate | 90%% MOE | CV | Severe rate | 90%% MOE | Reliability class (site rule) |")
say("|---|---|---|---|---|---|---|")
for (i in seq_len(nrow(cand))) with(cand[i, ], say("| %s | %s%% | ±%s pts | %s | %s%% | ±%s pts | %s |",
  zipcode, f1(rent_burden_rate), f1(rent_burden_rate_moe),
  ifelse(is.finite(rent_burden_rate_cv), paste0(f1(rent_burden_rate_cv), "%"), "undefined (estimate = 0)"),
  f1(severe_rent_burden_rate), f1(severe_rent_burden_rate_moe),
  ifelse(!is.finite(rent_burden_rate_cv), "unusable: zero-count estimate; MOE exceeds the estimate",
         ifelse(rent_burden_rate_cv > 30, "low (CV > 30%)", ifelse(rent_burden_rate_cv > 15, "moderate (CV 15–30%)", "good (CV ≤ 15%)")))))
say("")
say("Median household income (B19013): %s.", paste(sprintf("%s = %s (MOE %s)", inc$zipcode, inc$B19013_001E, inc$B19013_001M), collapse = "; "))
say("HPD records with these postcodes: %s.", if (nrow(hpd_pc)) paste(sprintf("%s: %d (%s)", hpd_pc$zipcode, hpd_pc$n, hpd_pc$Borough), collapse = "; ") else "none")
say("")
say("## 2. Geographic classification")
say("")
say("| ZCTA | Area (acres) | Centroid (lat, lon) | Adjacent analysed ZCTAs (≤100 ft) |")
say("|---|---|---|---|")
for (i in seq_len(nrow(geo))) with(geo[i, ], say("| %s | %s | %.4f, %.4f | %s |", zipcode, f1(area_acres), centroid_lat, centroid_lon, neighbours))
say("")
say("Independent spatial check of borough labels: %s HPD buildings with coordinates were placed inside the 2020 ZCTA polygons (point-in-polygon), covering %d analysed ZCTAs. Buildings whose HPD Borough differs from the ZCTA's HW4 borough: %s.",
    n0(nrow(joined)), zctas_tested,
    if (nrow(spatial_conflicts)) paste(sprintf("%s (HW4 %s; HPD %s: %d of its buildings, %.0f%%)", spatial_conflicts$ZCTA5CE20, spatial_conflicts$zcta_borough,
                                               spatial_conflicts$Borough, spatial_conflicts$n, 100 * spatial_conflicts$share), collapse = "; ") else "none")
say("HPD buildings located inside 10162/10279: %s.", if (nrow(cand_pts)) paste(sprintf("%s: %d (%s)", cand_pts$ZCTA5CE20, cand_pts$n, cand_pts$Borough), collapse = "; ") else "none")
say("")
say("## 3. HW4 inclusion criteria")
say("")
say("HW4 includes a ZCTA if (a) its ZIP falls in the hand-coded borough ranges and (b) for rates, `rent_burden_denominator > 0`.")
for (i in seq_len(nrow(cand))) with(cand[i, ], say("- **%s**: (a) %s; (b) denominator = %s → %s.", zipcode,
  ifelse(is.na(hw4_rule_borough), "not in the ranges (10162 is above 10128 and not listed; 10279 is not listed beside 10280/10282)", "in range"),
  n0(rent_burden_denominator), ifelse(rent_burden_denominator > 0, "meets the rate criterion", "fails")))
say("")
say("## 4. Impact of adding both ZCTAs to Manhattan (HW4 formulas unchanged)")
say("")
say("| Area | ZCTAs | Renter hh | Burdened | Rate (HW4) | Rate (with 2) | Δ pts | Severe (HW4) | Severe (with 2) | Δ pts | Rank (1 = highest) |")
say("|---|---|---|---|---|---|---|---|---|---|---|")
for (i in seq_len(nrow(cmp))) with(cmp[i, ], say("| %s | %d → %d | %s → %s | %s → %s | %s%% | %s%% | %+.3f | %s%% | %s%% | %+.3f | %s → %s |",
  borough, zips_base, zips_alt, n0(renters_base), n0(renters_alt), n0(burdened_base), n0(burdened_alt),
  f3(rate_base), f3(rate_alt), rate_diff_pts, f3(severe_base), f3(severe_alt), severe_diff_pts,
  ifelse(borough == "New York City", "—", rank_base), ifelse(borough == "New York City", "—", rank_alt)))
say("")
say("- Borough order, lowest → highest rate: HW4 `%s`; with both ZCTAs `%s` (%s).", paste(order_base, collapse = " < "), paste(order_alt, collapse = " < "),
    if (identical(order_base, order_alt)) "unchanged" else "CHANGED")
say("- Rounded to one decimal as in the HW4 figure, Manhattan's rate goes from %s%% to %s%%.",
    f1(cmp$rate_base[cmp$borough == "Manhattan"]), f1(cmp$rate_alt[cmp$borough == "Manhattan"]))
say("- Citywide median of ZIP rates: %s%% → %s%% (179 → %d ZCTAs).", f2(med_base), f2(med_alt), nrow(alt_full))
say("- HPD pressure-index top 10: %s.", if (identical(top10_alt, top10_pressure)) "identical order" else
    paste0("changes to ", paste(top10_alt, collapse = ", ")))
say("- Because the index is rank-based and rescaled over all ZCTAs, adding two ZCTAs shifts other ZIPs' index values by up to %s points (median |Δ| %s).",
    f1(max(abs(idx_shift$d))), f2(median(abs(idx_shift$d))))
for (z in CANDIDATES) {
  r <- alt_idx %>% filter(zipcode == z)
  if (nrow(r)) say("- %s would have rent-burden rank %d of %d and an HPD pressure index of %s (%s HPD units).", z, r$rb, nrow(alt_idx), f1(r$idx), n0(r$affordable_units))
}

writeLines(out, "validation/zip_inclusion_review.md")
write_csv(cmp, "validation/zip_inclusion_impact.csv")
cat(paste(out, collapse = "\n"), "\n")
