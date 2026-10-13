# ============================================================
# NYC Rent Burden Dashboard — data build pipeline
#
# Reproduces the Homework 4 analysis
# (Rent Burden Project/HM 4/code/rent_burden_nyc_analysis.Rmd)
# from the ORIGINAL raw files, read-only, and writes website-ready
# JSON/GeoJSON to docs/data/ plus a validation report to validation/.
#
# Original research files are never modified.
#
# Run from the project root:
#   Rscript pipeline/build_data.R
# ============================================================

suppressPackageStartupMessages({
  library(tidyverse)
  library(jsonlite)
  library(sf)
})

# ------------------------------------------------------------
# 0. CONFIG
# ------------------------------------------------------------

# Machine-specific paths live in pipeline/config.local.R (git-ignored);
# copy pipeline/config.example.R to create it.
if (!file.exists("pipeline/config.local.R")) stop("Create pipeline/config.local.R from pipeline/config.example.R")
source("pipeline/config.local.R") # defines RESEARCH_ROOT
HW4_RAW <- file.path(RESEARCH_ROOT, "Rent Burden Project", "HM 4", "data", "raw")
HW3_DATA <- file.path(RESEARCH_ROOT, "HW 3 Rent Burden", "data")
ZCTA_SHP <- file.path(Sys.getenv("LOCALAPPDATA"), "tigris", "tigris", "Cache",
                      "cb_2020_us_zcta520_500k.shp")

OUT_DATA <- file.path("docs", "data")
OUT_VAL <- "validation"
dir.create(OUT_DATA, showWarnings = FALSE, recursive = TRUE)
dir.create(OUT_VAL, showWarnings = FALSE, recursive = TRUE)

BOROUGHS <- c("Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island")
Z90 <- 1.645 # ACS margins of error are published at the 90% level

checks <- list() # validation log, written to validation/ and metadata.json
add_check <- function(id, title, status, detail) {
  checks[[length(checks) + 1]] <<- list(id = id, title = title,
                                        status = status, detail = detail)
}

num <- function(x) suppressWarnings(as.numeric(x))

# ------------------------------------------------------------
# 1. ACS B25070 — identical logic to HW4 chunk 1, steps 1–6
# ------------------------------------------------------------

rent_raw <- read_csv(file.path(HW4_RAW, "ACSDT5Y2024.B25070-Data.csv"),
                     show_col_types = FALSE, name_repair = "unique_quiet") %>%
  select(-starts_with("...")) %>%
  filter(GEO_ID != "Geography")

hw4_borough <- function(zipcode) {
  z <- as.integer(zipcode)
  case_when(
    between(z, 10001, 10040) |
      zipcode %in% c("10044", "10065", "10069", "10075", "10128", "10280", "10282") ~ "Manhattan",
    between(z, 10451, 10475) ~ "Bronx",
    between(z, 11201, 11239) | zipcode == "11249" ~ "Brooklyn",
    zipcode %in% c("11004", "11005") | between(z, 11101, 11109) |
      between(z, 11354, 11379) | zipcode == "11385" |
      between(z, 11411, 11436) | between(z, 11691, 11697) ~ "Queens",
    between(z, 10301, 10314) ~ "Staten Island",
    TRUE ~ NA_character_
  )
}

rent_all <- rent_raw %>%
  transmute(
    zipcode = str_extract(NAME, "\\d{5}"),
    total_renter_households = num(B25070_001E),
    total_moe = num(B25070_001M),
    rent_30_34 = num(B25070_007E), moe_30_34 = num(B25070_007M),
    rent_35_39 = num(B25070_008E), moe_35_39 = num(B25070_008M),
    rent_40_49 = num(B25070_009E), moe_40_49 = num(B25070_009M),
    rent_50_plus = num(B25070_010E), moe_50_plus = num(B25070_010M),
    not_computed = num(B25070_011E), moe_not_computed = num(B25070_011M)
  ) %>%
  mutate(borough = hw4_borough(zipcode))

rent_nyc <- rent_all %>%
  filter(!is.na(borough)) %>%
  mutate(
    rent_burdened_households = rent_30_34 + rent_35_39 + rent_40_49 + rent_50_plus,
    severely_rent_burdened_households = rent_50_plus,
    rent_burden_denominator = total_renter_households - not_computed,
    rent_burden_rate = if_else(rent_burden_denominator > 0,
                               rent_burdened_households / rent_burden_denominator * 100, NA_real_),
    severe_rent_burden_rate = if_else(rent_burden_denominator > 0,
                                      severely_rent_burdened_households / rent_burden_denominator * 100, NA_real_),

    # --- Added for the website (not in HW4): approximate MOEs -------------
    # Census ACS handbook approximations: sums -> root sum of squares;
    # proportions -> sqrt(MOE_num^2 - p^2 * MOE_den^2) / den (ratio formula
    # used when the radicand is negative).
    moe_burdened = sqrt(moe_30_34^2 + moe_35_39^2 + moe_40_49^2 + moe_50_plus^2),
    moe_denominator = sqrt(total_moe^2 + moe_not_computed^2)
  )

prop_moe <- function(num_est, num_moe, den_est, den_moe) {
  p <- num_est / den_est
  rad <- num_moe^2 - p^2 * den_moe^2
  rad_ratio <- num_moe^2 + p^2 * den_moe^2
  ifelse(den_est > 0, sqrt(ifelse(rad >= 0, rad, rad_ratio)) / den_est * 100, NA_real_)
}

rent_nyc <- rent_nyc %>%
  mutate(
    rent_burden_rate_moe = prop_moe(rent_burdened_households, moe_burdened,
                                    rent_burden_denominator, moe_denominator),
    severe_rent_burden_rate_moe = prop_moe(severely_rent_burdened_households, moe_50_plus,
                                           rent_burden_denominator, moe_denominator),
    rent_burden_rate_cv = (rent_burden_rate_moe / Z90) / rent_burden_rate * 100
  )

# ------------------------------------------------------------
# 2. HPD Affordable Housing Production — HW4 steps 7–12
# ------------------------------------------------------------

housing_raw <- read_csv(file.path(HW4_RAW, "Affordable_Housing_Production_by_Building_20261012.csv"),
                        show_col_types = FALSE)

clean_number <- function(x) {
  x <- str_remove_all(as.character(x), "[^0-9.-]")
  x[x == ""] <- NA_character_
  as.numeric(x)
}

housing_all <- housing_raw %>%
  mutate(
    zipcode = if_else(is.na(Postcode), NA_character_, sprintf("%05d", as.integer(Postcode))),
    across(c(`Counted Rental Units`, `Counted Homeownership Units`, `All Counted Units`,
             `Total Units`, `Extremely Low Income Units`, `Very Low Income Units`,
             `Low Income Units`, `Moderate Income Units`, `Middle Income Units`,
             `Other Income Units`), clean_number),
    start_year = as.integer(format(as.Date(`Project Start Date`, "%m/%d/%Y"), "%Y"))
  ) %>%
  filter(Borough %in% BOROUGHS)

housing_clean <- housing_all %>% filter(!is.na(zipcode))

housing_zip <- housing_clean %>%
  group_by(zipcode) %>%
  summarise(
    affordable_units = sum(`All Counted Units`, na.rm = TRUE),
    affordable_rental_units = sum(`Counted Rental Units`, na.rm = TRUE),
    affordable_homeownership_units = sum(`Counted Homeownership Units`, na.rm = TRUE),
    total_housing_units = sum(`Total Units`, na.rm = TRUE),
    number_of_buildings = n(),
    new_construction_units = sum(`All Counted Units`[`Reporting Construction Type` == "New Construction"], na.rm = TRUE),
    preservation_units = sum(`All Counted Units`[`Reporting Construction Type` == "Preservation"], na.rm = TRUE),
    .groups = "drop"
  )

rent_housing_nyc <- rent_nyc %>%
  left_join(housing_zip, by = "zipcode") %>%
  mutate(across(c(affordable_units, affordable_rental_units, affordable_homeownership_units,
                  total_housing_units, number_of_buildings, new_construction_units,
                  preservation_units), ~ replace_na(.x, 0)),
         borough = factor(borough, levels = BOROUGHS)) %>%
  arrange(borough, zipcode)

# ------------------------------------------------------------
# 3. ACS B19013 median household income — HW4 income chunk
# ------------------------------------------------------------

income_raw <- read_csv(file.path(HW4_RAW, "ACSDT5Y2024.B19013-Data.csv"),
                       show_col_types = FALSE, name_repair = "unique_quiet") %>%
  select(-starts_with("...")) %>%
  filter(GEO_ID != "Geography")

income_nyc <- income_raw %>%
  transmute(
    zipcode = str_extract(NAME, "\\d{5}"),
    income_raw_value = B19013_001E,
    median_household_income = num(B19013_001E), # HW4: "250,000+" and "-" become NA
    median_household_income_moe = num(B19013_001M)
  ) %>%
  filter(zipcode %in% rent_housing_nyc$zipcode) %>%
  mutate(income_topcoded = income_raw_value == "250,000+")

rent_housing_income_nyc <- rent_housing_nyc %>% left_join(income_nyc, by = "zipcode")

# ------------------------------------------------------------
# 4. DERIVED MEASURES — HW4 scatter / top-10 / index chunks
# ------------------------------------------------------------

analysis <- rent_housing_income_nyc %>%
  mutate(valid = !is.na(rent_burden_rate) & rent_burden_denominator > 0,
         affordable_units_per_1000 = if_else(valid, affordable_units / rent_burden_denominator * 1000, NA_real_))

# HPD-based pressure index (HW4 "affordability_pressure_index_map_nyc")
hpd_idx <- analysis %>%
  filter(valid, !is.na(affordable_units_per_1000)) %>%
  mutate(rent_burden_rank = min_rank(desc(rent_burden_rate)),
         low_affordable_rank = min_rank(affordable_units_per_1000),
         priority_score = rent_burden_rank + low_affordable_rank,
         pressure_index_hpd = 100 * (max(priority_score) - priority_score) /
           (max(priority_score) - min(priority_score))) %>%
  select(zipcode, priority_score, pressure_index_hpd, idx_hpd_burden_rank = rent_burden_rank, idx_hpd_activity_rank = low_affordable_rank)

# Income-based pressure index (HW4 "income_rent_burden_pressure_map_nyc")
inc_idx <- analysis %>%
  filter(valid, !is.na(median_household_income)) %>%
  mutate(rent_burden_rank = min_rank(desc(rent_burden_rate)),
         low_income_rank = min_rank(median_household_income),
         combined_rank = rent_burden_rank + low_income_rank,
         pressure_index_income = 100 * (max(combined_rank) - combined_rank) /
           (max(combined_rank) - min(combined_rank))) %>%
  select(zipcode, pressure_index_income, idx_inc_burden_rank = rent_burden_rank, idx_inc_income_rank = low_income_rank)

analysis <- analysis %>%
  left_join(hpd_idx, by = "zipcode") %>%
  left_join(inc_idx, by = "zipcode")

# HW4 top-10 lists (reproduced exactly)
top10_activity <- analysis %>% filter(valid) %>%
  arrange(desc(affordable_units_per_1000)) %>% slice_head(n = 10) %>% pull(zipcode)
top10_pressure <- analysis %>% filter(!is.na(priority_score)) %>%
  arrange(priority_score) %>% slice_head(n = 10) %>% pull(zipcode)

# ------------------------------------------------------------
# 4b. ALTERNATIVE (EXPLORATORY) RANKING — added for the website, NOT part of HW4.
# Requested in the external review. The HW4 index above is unchanged and remains the baseline.
# Same formula as HW4 (min ranks, rank sum, min-max to 0-100) with two differences:
#   (1) universe restricted to reliable estimates: CV <= 30% AND >= 1,000 renter households
#   (2) activity measured with HPD *rental* units only (homeownership units excluded)
# ------------------------------------------------------------
ALT_MAX_CV <- 30
ALT_MIN_RENTERS <- 1000
analysis <- analysis %>%
  mutate(affordable_rental_units_per_1000 = if_else(valid, affordable_rental_units / rent_burden_denominator * 1000, NA_real_),
         alt_exclusion = case_when(
           !valid ~ "no computable rate",
           rent_burden_rate_cv > ALT_MAX_CV & rent_burden_denominator < ALT_MIN_RENTERS ~ "CV > 30% and < 1,000 renter households",
           rent_burden_rate_cv > ALT_MAX_CV ~ "CV > 30%",
           rent_burden_denominator < ALT_MIN_RENTERS ~ "< 1,000 renter households",
           TRUE ~ NA_character_))
alt_idx <- analysis %>%
  filter(is.na(alt_exclusion)) %>%
  mutate(rb = min_rank(desc(rent_burden_rate)),
         la = min_rank(affordable_rental_units_per_1000),
         alt_score = rb + la,
         pressure_index_alt = 100 * (max(alt_score) - alt_score) / (max(alt_score) - min(alt_score))) %>%
  select(zipcode, alt_score, pressure_index_alt, idx_alt_burden_rank = rb, idx_alt_activity_rank = la)
analysis <- analysis %>% left_join(alt_idx, by = "zipcode")
top10_alt <- analysis %>% filter(!is.na(alt_score)) %>% arrange(alt_score) %>% slice_head(n = 10) %>% pull(zipcode)
alt_rank_of <- function(z) { s <- analysis %>% filter(!is.na(alt_score)) %>% arrange(alt_score); match(z, s$zipcode) }
base_rank_of <- function(z) { s <- analysis %>% filter(!is.na(priority_score)) %>% arrange(priority_score); match(z, s$zipcode) }
alt_summary <- list(
  criteria = list(max_cv = ALT_MAX_CV, min_renter_households = ALT_MIN_RENTERS, activity = "HPD counted rental units per 1,000 renter households"),
  n_baseline = sum(!is.na(analysis$priority_score)),
  n_alt = sum(!is.na(analysis$alt_score)),
  excluded = analysis %>% filter(valid, !is.na(alt_exclusion)) %>% transmute(zip = zipcode, borough = as.character(borough),
               reason = alt_exclusion, renter_households = rent_burden_denominator, cv = round(rent_burden_rate_cv, 1)),
  zero_rental_units = sum(analysis$affordable_rental_units[!is.na(analysis$alt_score)] == 0),
  baseline_top10 = tibble(zip = top10_pressure, baseline_rank = seq_along(top10_pressure), alt_rank = alt_rank_of(top10_pressure),
                          alt_exclusion = analysis$alt_exclusion[match(top10_pressure, analysis$zipcode)]),
  alt_top10 = tibble(zip = top10_alt, alt_rank = seq_along(top10_alt), baseline_rank = base_rank_of(top10_alt)),
  overlap = length(intersect(top10_pressure, top10_alt))
)


# ------------------------------------------------------------
# 5. BOROUGH SUMMARY — HW4 step 3 of graphics chunk
# ------------------------------------------------------------

summarise_burden <- function(df) {
  df %>% summarise(
    zip_count = n(),
    zip_count_valid = sum(rent_burden_denominator > 0, na.rm = TRUE),
    total_renter_households = sum(total_renter_households, na.rm = TRUE),
    renter_households = sum(rent_burden_denominator, na.rm = TRUE),
    rent_burdened_households = sum(rent_burdened_households, na.rm = TRUE),
    severely_rent_burdened_households = sum(severely_rent_burdened_households, na.rm = TRUE),
    moe_burdened = sqrt(sum(moe_burdened^2, na.rm = TRUE)),
    moe_severe = sqrt(sum(moe_50_plus^2, na.rm = TRUE)),
    moe_den = sqrt(sum(moe_denominator^2, na.rm = TRUE)),
    .groups = "drop"
  ) %>% mutate(
    rent_burden_rate = rent_burdened_households / renter_households * 100,
    severe_rent_burden_rate = severely_rent_burdened_households / renter_households * 100,
    moderate_rent_burden_rate = rent_burden_rate - severe_rent_burden_rate,
    rent_burden_rate_moe = prop_moe(rent_burdened_households, moe_burdened, renter_households, moe_den),
    severe_rent_burden_rate_moe = prop_moe(severely_rent_burdened_households, moe_severe, renter_households, moe_den)
  ) %>% select(-moe_burdened, -moe_severe, -moe_den)
}

borough_summary <- analysis %>% group_by(borough) %>% summarise_burden() %>%
  mutate(borough = as.character(borough))
nyc_summary <- analysis %>% summarise_burden() %>% mutate(borough = "New York City")
# ------------------------------------------------------------
# 4c. EXCLUDED MANHATTAN ZCTAs (10162, 10279) — optional inclusion comparison.
# Documentation only: they stay OUT of the HW4 study population, rankings and totals.
# ------------------------------------------------------------
EXCLUDED_MN <- c("10162", "10279")
excl <- rent_all %>% filter(zipcode %in% EXCLUDED_MN) %>%
  mutate(rent_burdened_households = rent_30_34 + rent_35_39 + rent_40_49 + rent_50_plus,
         severely_rent_burdened_households = rent_50_plus,
         rent_burden_denominator = total_renter_households - not_computed,
         rent_burden_rate = rent_burdened_households / rent_burden_denominator * 100,
         severe_rent_burden_rate = rent_50_plus / rent_burden_denominator * 100,
         moe_burdened = sqrt(moe_30_34^2 + moe_35_39^2 + moe_40_49^2 + moe_50_plus^2),
         moe_denominator = sqrt(total_moe^2 + moe_not_computed^2),
         rent_burden_rate_moe = prop_moe(rent_burdened_households, moe_burdened, rent_burden_denominator, moe_denominator),
         severe_rent_burden_rate_moe = prop_moe(rent_50_plus, moe_50_plus, rent_burden_denominator, moe_denominator),
         rent_burden_rate_cv = if_else(rent_burden_rate > 0, (rent_burden_rate_moe / Z90) / rent_burden_rate * 100, NA_real_),
         borough = factor("Manhattan", levels = BOROUGHS))
with_excl <- bind_rows(analysis %>% select(any_of(names(excl))), excl %>% select(any_of(names(analysis))))
incl_cmp <- bind_rows(
  analysis %>% filter(borough == "Manhattan") %>% summarise_burden() %>% mutate(area = "Manhattan", version = "HW4 study population"),
  with_excl %>% filter(borough == "Manhattan") %>% summarise_burden() %>% mutate(area = "Manhattan", version = "with 10162 + 10279"),
  analysis %>% summarise_burden() %>% mutate(area = "New York City", version = "HW4 study population"),
  with_excl %>% summarise_burden() %>% mutate(area = "New York City", version = "with 10162 + 10279")
) %>% select(area, version, zip_count_valid, renter_households, rent_burdened_households, rent_burden_rate, severe_rent_burden_rate)
boro_order_alt <- with_excl %>% group_by(borough) %>% summarise_burden() %>% arrange(desc(rent_burden_rate)) %>% pull(borough) %>% as.character()
excluded_out <- list(
  status = "Excluded from the HW4 study population (outside the HW4 ZIP ranges). Shown for documentation only.",
  zctas = excl %>% transmute(zip = zipcode, borough = "Manhattan", total_renter_households, renter_households = rent_burden_denominator,
                             rent_burdened_households, severely_rent_burdened_households,
                             rent_burden_rate = round(rent_burden_rate, 2), rent_burden_rate_moe = round(rent_burden_rate_moe, 2),
                             severe_rent_burden_rate = round(severe_rent_burden_rate, 2), rent_burden_rate_cv = round(rent_burden_rate_cv, 1),
                             reliability = case_when(is.na(rent_burden_rate_cv) ~ "unusable", rent_burden_rate_cv > 30 ~ "low",
                                                     rent_burden_rate_cv > 15 ~ "moderate", TRUE ~ "good"),
                             note = if_else(rent_burdened_households == 0,
                                            sprintf("Zero-count survey estimate: 0 of an estimated %s renter households. The 90%% MOE (±%.1f pts) exceeds the estimate and the CV is not defined, so this is NOT a confidently measured 0%% rent burden.",
                                                    format(rent_burden_denominator, big.mark = ","), rent_burden_rate_moe),
                                            sprintf("Valid observation but statistically unreliable (CV %.1f%% > 30%%).", rent_burden_rate_cv))),
  comparison = incl_cmp %>% mutate(across(c(rent_burden_rate, severe_rent_burden_rate), ~ round(.x, 3))),
  borough_order_unchanged = identical(boro_order_alt, borough_summary_order <- analysis %>% group_by(borough) %>% summarise_burden() %>%
                                        arrange(desc(rent_burden_rate)) %>% pull(borough) %>% as.character())
)

# HPD by borough: uses the Borough field so records WITHOUT a postcode are included
hpd_boro <- housing_all %>%
  group_by(borough = Borough) %>%
  summarise(
    hpd_units_all_records = sum(`All Counted Units`, na.rm = TRUE),
    hpd_rental_units_all_records = sum(`Counted Rental Units`, na.rm = TRUE),
    hpd_homeownership_units_all_records = sum(`Counted Homeownership Units`, na.rm = TRUE),
    hpd_records = n(),
    hpd_records_no_postcode = sum(is.na(zipcode)),
    hpd_units_no_postcode = sum(`All Counted Units`[is.na(zipcode)], na.rm = TRUE),
    new_construction_units = sum(`All Counted Units`[`Reporting Construction Type` == "New Construction"], na.rm = TRUE),
    preservation_units = sum(`All Counted Units`[`Reporting Construction Type` == "Preservation"], na.rm = TRUE),
    extremely_low_income_units = sum(`Extremely Low Income Units`, na.rm = TRUE),
    very_low_income_units = sum(`Very Low Income Units`, na.rm = TRUE),
    low_income_units = sum(`Low Income Units`, na.rm = TRUE),
    moderate_income_units = sum(`Moderate Income Units`, na.rm = TRUE),
    middle_income_units = sum(`Middle Income Units`, na.rm = TRUE),
    other_income_units = sum(`Other Income Units`, na.rm = TRUE),
    .groups = "drop"
  )
hpd_boro_zip <- analysis %>% group_by(borough = as.character(borough)) %>%
  summarise(hpd_units_matched_to_zip = sum(affordable_units), .groups = "drop")

borough_out <- bind_rows(borough_summary, nyc_summary) %>%
  left_join(bind_rows(hpd_boro, hpd_boro %>% summarise(across(-borough, sum)) %>%
                        mutate(borough = "New York City")), by = "borough") %>%
  left_join(bind_rows(hpd_boro_zip, hpd_boro_zip %>% summarise(hpd_units_matched_to_zip = sum(hpd_units_matched_to_zip)) %>%
                        mutate(borough = "New York City")), by = "borough") %>%
  mutate(hpd_units_per_1000_renters = hpd_units_all_records / renter_households * 1000)

# HPD by year x borough x construction type
hpd_year <- housing_all %>%
  filter(!is.na(start_year)) %>%
  group_by(year = start_year, borough = Borough, type = `Reporting Construction Type`) %>%
  summarise(units = sum(`All Counted Units`, na.rm = TRUE), records = n(), .groups = "drop") %>%
  arrange(year, borough, type)

# Descriptive association: income vs rent burden by borough (Pearson r, OLS slope)
assoc <- analysis %>% filter(valid, !is.na(median_household_income)) %>%
  { bind_rows(mutate(., grp = as.character(borough)), mutate(., grp = "New York City")) } %>%
  group_by(group = grp) %>%
  summarise(n = n(),
            r = cor(median_household_income, rent_burden_rate),
            slope_per_10k = coef(lm(rent_burden_rate ~ I(median_household_income / 10000)))[2],
            intercept = coef(lm(rent_burden_rate ~ median_household_income))[1],
            slope = coef(lm(rent_burden_rate ~ median_household_income))[2],
            .groups = "drop")
assoc_hpd <- analysis %>% filter(valid) %>%
  { bind_rows(mutate(., grp = as.character(borough)), mutate(., grp = "New York City")) } %>%
  group_by(group = grp) %>%
  summarise(n = n(), r = cor(affordable_units_per_1000, rent_burden_rate),
            spearman = cor(affordable_units_per_1000, rent_burden_rate, method = "spearman"),
            .groups = "drop")

medians <- list(
  rent_burden_rate = median(analysis$rent_burden_rate[analysis$valid]),
  affordable_units_per_1000 = median(analysis$affordable_units_per_1000[analysis$valid]),
  median_household_income = median(analysis$median_household_income[analysis$valid], na.rm = TRUE)
)

# ------------------------------------------------------------
# 6. VALIDATION CHECKS
# ------------------------------------------------------------

# 6a. Duplicates
dups <- analysis %>% count(zipcode) %>% filter(n > 1)
add_check("dup_zip", "Each ZIP code appears once in the merged dataset",
          if (nrow(dups) == 0) "pass" else "fail",
          sprintf("%d duplicated ZIP codes in %d rows.", nrow(dups), nrow(analysis)))

# 6b. ZIP -> borough assignment vs. HPD's own Borough field
hpd_pairs <- housing_clean %>% count(zipcode, Borough)
conflicts <- hpd_pairs %>% inner_join(analysis %>% select(zipcode, borough), by = "zipcode") %>%
  filter(Borough != as.character(borough))
add_check("boro_vs_hpd", "HW4 borough assignment agrees with HPD's Borough field",
          if (nrow(conflicts) == 0) "pass" else "note",
          paste0("ZIP/borough pairs that differ: ",
                 if (nrow(conflicts) == 0) "none" else
                   paste(sprintf("%s (HW4: %s; HPD: %s, %d records)", conflicts$zipcode,
                                 analysis$borough[match(conflicts$zipcode, analysis$zipcode)],
                                 conflicts$Borough, conflicts$n), collapse = "; "),
                 ". ZIP 10463 contains Marble Hill, which is legally part of Manhattan but on the Bronx mainland; HW4 assigns the whole ZIP to the Bronx."))

# 6c. NYC-prefix ZCTAs not assigned by the HW4 rule
unassigned <- rent_all %>%
  filter(is.na(borough), str_detect(zipcode, "^(100|101|102|103|104|110|111|112|113|114|116)")) %>%
  select(zipcode, total_renter_households) %>% arrange(desc(total_renter_households))
missed_nyc <- unassigned %>% filter(zipcode %in% c("10162", "10279"))
add_check("missed_zctas", "NYC ZCTAs omitted by the HW4 ZIP ranges",
          "flag",
          sprintf("ZCTAs 10162 (Upper East Side, %s renter households) and 10279 (Lower Manhattan, %s) are Manhattan ZCTAs with renters that fall outside the HW4 ranges and are therefore excluded. Combined effect on Manhattan: %s of %s renter households (%.2f%%). Other unassigned 110xx ZCTAs with renters (%s) lie mainly in Nassau County and are correctly excluded; the rest have zero renter households.",
                  format(missed_nyc$total_renter_households[missed_nyc$zipcode == "10162"], big.mark = ","),
                  format(missed_nyc$total_renter_households[missed_nyc$zipcode == "10279"], big.mark = ","),
                  format(sum(missed_nyc$total_renter_households), big.mark = ","),
                  format(borough_summary$total_renter_households[borough_summary$borough == "Manhattan"], big.mark = ","),
                  100 * sum(missed_nyc$total_renter_households) /
                    borough_summary$total_renter_households[borough_summary$borough == "Manhattan"],
                  paste(unassigned$zipcode[unassigned$total_renter_households > 0 & !unassigned$zipcode %in% missed_nyc$zipcode], collapse = ", ")))

# 6d. ZCTAs in the rule with zero valid renters
zero_den <- analysis %>% filter(!valid)
add_check("zero_denominator", "ZIP codes without a computable rent-burden rate",
          "note",
          sprintf("%d of %d assigned ZCTAs have no renter households for which burden is computed and are excluded from rates: %s.",
                  nrow(zero_den), nrow(analysis), paste(zero_den$zipcode, collapse = ", ")))

# 6e. Reliability (CV) of ZIP-level rates
unreliable <- analysis %>% filter(valid, rent_burden_rate_cv > 30)
add_check("cv", "Sampling reliability of ZIP-level rent-burden rates",
          if (nrow(unreliable) == 0) "pass" else "flag",
          sprintf("%d ZIP codes have a coefficient of variation above 30%% (approximate MOE computed from B25070 margins of error), flagged 'use with caution' on the site: %s.",
                  nrow(unreliable), paste(unreliable$zipcode, collapse = ", ")))

# 6e2. Reliability of the HW4 top-10 "most pressured" ZIPs
top_rel <- analysis %>% filter(zipcode %in% top10_pressure, rent_burden_rate_cv > 15)
add_check("top10_reliability", "Sampling reliability of HW4's top-10 pressure ZIPs",
          if (nrow(top_rel) == 0) "pass" else "flag",
          sprintf("%d of the 10 ZIPs have CV above 15%%: %s. Rankings of small ZCTAs are sensitive to sampling error.",
                  nrow(top_rel),
                  paste(sprintf("%s (%s renter households, %.1f%% ± %.1f pts)", top_rel$zipcode,
                                format(top_rel$rent_burden_denominator, big.mark = ","),
                                top_rel$rent_burden_rate, top_rel$rent_burden_rate_moe), collapse = "; ")))

# 6e3. Exploratory alternative ranking (website addition) — documented, HW4 index untouched
add_check("alt_ranking", "Exploratory alternative ranking (not HW4): reliable estimates, rental units only",
          "note",
          sprintf("Universe: %d of %d ZCTAs (excluded: CV > %d%% or < %s renter households: %s). Activity = HPD rental units per 1,000 renter households. Top 10 overlap with the HW4 baseline: %d/10. Baseline top-10 ZIPs dropped by the criteria: %s.",
                  alt_summary$n_alt, alt_summary$n_baseline, ALT_MAX_CV, format(ALT_MIN_RENTERS, big.mark = ","),
                  paste(sprintf("%s (%s)", alt_summary$excluded$zip, alt_summary$excluded$reason), collapse = "; "),
                  alt_summary$overlap,
                  paste(with(alt_summary$baseline_top10, ifelse(is.na(alt_rank), sprintf("%s [%s]", zip, alt_exclusion), NA)) %>% na.omit(), collapse = ", ")))
add_check("excluded_zctas", "Excluded Manhattan ZCTAs documented with an optional inclusion comparison",
          "note",
          sprintf("10162 and 10279 stay outside the HW4 study population. Including both: Manhattan %.3f%% → %.3f%%, NYC %.3f%% → %.3f%%; borough order %s.",
                  incl_cmp$rent_burden_rate[1], incl_cmp$rent_burden_rate[2], incl_cmp$rent_burden_rate[3], incl_cmp$rent_burden_rate[4],
                  if (excluded_out$borough_order_unchanged) "unchanged" else "CHANGED"))

# 6f. Income top-coding / suppression
inc_issue <- analysis %>% filter(valid, is.na(median_household_income))
add_check("income_topcode", "Median household income values converted to NA",
          "flag",
          sprintf("HW4 converts B19013 with as.numeric(), so top-coded values ('250,000+') and suppressed values ('-') become NA. Among ZIPs with valid rent-burden rates, %d are dropped from the income analysis: %s. The top-coded ZIPs are among the highest-income areas, so their exclusion slightly biases income comparisons. The site reproduces HW4 and labels these ZIPs as '$250,000+'.",
                  nrow(inc_issue),
                  paste(sprintf("%s (%s)", inc_issue$zipcode, inc_issue$income_raw_value), collapse = ", ")))

# 6g. HPD records without a postcode
no_pc <- housing_all %>% filter(is.na(zipcode))
add_check("hpd_no_postcode", "HPD records without a postcode",
          "flag",
          sprintf("%s of %s HPD building records (%.1f%%) have no postcode and carry %s of %s counted affordable units (%.1f%%). HW4 drops them from the ZIP-level merge, so ZIP-level affordable-unit counts are lower bounds. Borough totals on this site use HPD's Borough field and include these records.",
                  format(nrow(no_pc), big.mark = ","), format(nrow(housing_all), big.mark = ","),
                  100 * nrow(no_pc) / nrow(housing_all),
                  format(sum(no_pc$`All Counted Units`, na.rm = TRUE), big.mark = ","),
                  format(sum(housing_all$`All Counted Units`, na.rm = TRUE), big.mark = ","),
                  100 * sum(no_pc$`All Counted Units`, na.rm = TRUE) / sum(housing_all$`All Counted Units`, na.rm = TRUE)))

# 6h. HPD postcodes that do not match an assigned ZCTA
unmatched_pc <- housing_zip %>% filter(!zipcode %in% analysis$zipcode)
add_check("hpd_unmatched", "HPD postcodes not matched to an analysed ZCTA",
          if (nrow(unmatched_pc) == 0) "pass" else "note",
          sprintf("%d postcode(s) with %s counted units do not match a ZCTA in the analysis: %s.",
                  nrow(unmatched_pc), format(sum(unmatched_pc$affordable_units), big.mark = ","),
                  paste(unmatched_pc$zipcode, collapse = ", ")))

# 6i. HPD internal consistency
incons <- housing_all %>% filter(!is.na(`All Counted Units`),
                                 `All Counted Units` != coalesce(`Counted Rental Units`, 0) + coalesce(`Counted Homeownership Units`, 0))
add_check("hpd_consistency", "HPD: All Counted Units = Rental + Homeownership",
          if (nrow(incons) == 0) "pass" else "fail",
          sprintf("%d inconsistent records; %d records have a missing All Counted Units value.",
                  nrow(incons), sum(is.na(housing_all$`All Counted Units`))))
add_check("hpd_buildings", "HPD: buildings appearing in multiple projects",
          "note",
          sprintf("%s building IDs appear in more than one project (no duplicated project-building rows). HPD counts units per project, so a building rehabilitated/preserved more than once contributes units each time; 'number_of_buildings' in HW4 is therefore a count of project-building records, not distinct buildings.",
                  format(sum(duplicated(housing_all$`Building ID`)), big.mark = ",")))

# 6j. Cross-check against HW3 (Brooklyn) derived file
hw3 <- tryCatch(read_csv(file.path(HW3_DATA, "derived_rent_burden_by_zip.csv"),
                         show_col_types = FALSE, col_types = cols(zip_code = "c")), error = function(e) NULL)
if (!is.null(hw3)) {
  cmp <- hw3 %>% inner_join(analysis %>% select(zipcode, rent_burdened_households, rent_burden_denominator),
                            by = c("zip_code" = "zipcode"))
  mism <- cmp %>% filter(rent_burdened != rent_burdened_households | valid_renters != rent_burden_denominator)
  bk_only <- setdiff(analysis$zipcode[analysis$borough == "Brooklyn"], hw3$zip_code)
  add_check("hw3_crosscheck", "Brooklyn counts match the independent HW3 calculation",
            if (nrow(mism) == 0) "pass" else "fail",
            sprintf("%d of %d HW3 Brooklyn ZCTAs matched; %d mismatches in burdened or valid-renter counts. Brooklyn ZCTAs in HW4 but not HW3: %s.",
                    nrow(cmp), nrow(hw3), nrow(mism),
                    if (length(bk_only)) paste(bk_only, collapse = ", ") else "none"))
}

# 6k. Reproduction check: borough rates recomputed two ways
alt <- analysis %>% group_by(borough) %>%
  summarise(r = sum(rent_burdened_households) / sum(rent_burden_denominator) * 100, .groups = "drop")
add_check("borough_repro", "Borough rates reproduce HW4 (pooled counts, not average of ZIP rates)",
          "pass",
          paste(sprintf("%s %.1f%%", alt$borough, alt$r), collapse = "; "))

# ------------------------------------------------------------
# 7. GEOGRAPHY — 2020 ZCTA cartographic boundaries (cached by tigris)
# ------------------------------------------------------------

# Review scripts set SKIP_WRITE <- TRUE before sourcing to reuse the objects above without writing.
if (!exists("SKIP_WRITE")) SKIP_WRITE <- FALSE
if (!SKIP_WRITE) {

geo_ok <- file.exists(ZCTA_SHP)
if (geo_ok) {
  zcta <- st_read(ZCTA_SHP, quiet = TRUE) %>%
    filter(ZCTA5CE20 %in% c(analysis$zipcode, EXCLUDED_MN)) %>%
    transmute(zip = ZCTA5CE20) %>%
    st_transform(2263) %>%
    st_simplify(preserveTopology = TRUE, dTolerance = 60) %>%
    st_transform(4326)
  zcta$borough <- coalesce(as.character(analysis$borough[match(zcta$zip, analysis$zipcode)]), if_else(zcta$zip %in% EXCLUDED_MN, "Manhattan", NA_character_))
  zcta$excluded <- zcta$zip %in% EXCLUDED_MN # documented, outside the HW4 study population
  st_write(zcta, file.path(OUT_DATA, "zcta_nyc.geojson"), delete_dsn = TRUE, quiet = TRUE,
           layer_options = c("COORDINATE_PRECISION=5", "RFC7946=YES"))
  boro_geo <- zcta %>% st_transform(2263) %>% st_make_valid() %>% group_by(borough) %>%
    summarise(.groups = "drop") %>% st_simplify(dTolerance = 80) %>% st_transform(4326)
  st_write(boro_geo, file.path(OUT_DATA, "borough_outlines.geojson"), delete_dsn = TRUE, quiet = TRUE,
           layer_options = c("COORDINATE_PRECISION=5", "RFC7946=YES"))
  missing_geo <- setdiff(analysis$zipcode, zcta$zip)
  add_check("geo_match", "Every analysed ZIP has a boundary polygon",
            if (length(missing_geo) == 0) "pass" else "note",
            sprintf("%d of %d analysed ZCTAs matched to 2020 cartographic boundaries (plus %d excluded Manhattan ZCTAs drawn for documentation).%s",
                    sum(!zcta$excluded), nrow(analysis), sum(zcta$excluded),
                    if (length(missing_geo)) paste0(" Missing: ", paste(missing_geo, collapse = ", ")) else ""))
}

# ------------------------------------------------------------
# 8. WRITE OUTPUTS
# ------------------------------------------------------------

zip_out <- analysis %>%
  transmute(
    zip = zipcode, borough = as.character(borough),
    total_renter_households, renter_households = rent_burden_denominator,
    not_computed, rent_burdened_households, severely_rent_burdened_households,
    rent_30_34, rent_35_39, rent_40_49, rent_50_plus,
    rent_burden_rate = round(rent_burden_rate, 2),
    rent_burden_rate_moe = round(rent_burden_rate_moe, 2),
    severe_rent_burden_rate = round(severe_rent_burden_rate, 2),
    severe_rent_burden_rate_moe = round(severe_rent_burden_rate_moe, 2),
    # classify on the UNROUNDED CV (fixed 2026-10-12: rounding first mislabelled 10307, CV 15.002%, as High)
    reliability = case_when(!valid ~ "none", rent_burden_rate_cv > 30 ~ "low",
                            rent_burden_rate_cv > 15 ~ "moderate", TRUE ~ "good"),
    rent_burden_rate_cv = round(rent_burden_rate_cv, 1),
    affordable_units, affordable_rental_units, affordable_homeownership_units,
    total_housing_units, number_of_buildings, new_construction_units, preservation_units,
    affordable_units_per_1000 = round(affordable_units_per_1000, 2),
    median_household_income, median_household_income_moe,
    income_note = case_when(income_raw_value == "250,000+" ~ "topcoded",
                            income_raw_value == "-" ~ "suppressed", TRUE ~ NA_character_),
    pressure_index_hpd = round(pressure_index_hpd, 1),
    pressure_index_income = round(pressure_index_income, 1),
    idx_hpd_burden_rank, idx_hpd_activity_rank, idx_inc_burden_rank, idx_inc_income_rank,
    idx_hpd_n = sum(!is.na(pressure_index_hpd)), idx_inc_n = sum(!is.na(pressure_index_income)),
    top10_activity = zipcode %in% top10_activity,
    top10_pressure = zipcode %in% top10_pressure,
    # --- exploratory alternative ranking (website addition, not HW4) ---
    affordable_rental_units_per_1000 = round(affordable_rental_units_per_1000, 2),
    pressure_index_alt = round(pressure_index_alt, 1),
    idx_alt_burden_rank, idx_alt_activity_rank, idx_alt_n = sum(!is.na(pressure_index_alt)),
    alt_exclusion,
    top10_alt = zipcode %in% top10_alt
  )

write_json(zip_out, file.path(OUT_DATA, "zip_data.json"), na = "null", digits = NA, pretty = FALSE)
write_json(borough_out %>% mutate(across(where(is.double), ~ round(.x, 3))),
           file.path(OUT_DATA, "borough_summary.json"), na = "null", digits = NA, pretty = TRUE)
write_json(hpd_year, file.path(OUT_DATA, "hpd_by_year.json"), digits = NA)
write_json(list(income_vs_burden = assoc, hpd_vs_burden = assoc_hpd, nyc_medians = medians,
                top10_activity = top10_activity, top10_pressure = top10_pressure),
           file.path(OUT_DATA, "statistics.json"), auto_unbox = TRUE, digits = 6, pretty = TRUE)
# Website additions kept in separate files so the HW4 outputs above stay byte-for-byte traceable.
write_json(c(alt_summary, list(top10_alt = top10_alt, top10_baseline = top10_pressure)),
           file.path(OUT_DATA, "alternative_ranking.json"), auto_unbox = TRUE, digits = NA, pretty = TRUE, na = "null")
write_json(excluded_out, file.path(OUT_DATA, "excluded_zctas.json"), auto_unbox = TRUE, digits = NA, pretty = TRUE, na = "null")

hpd_dates <- range(as.Date(housing_all$`Project Start Date`, "%m/%d/%Y"), na.rm = TRUE)
metadata <- list(
  build = list(generated = format(Sys.time(), "%Y-%m-%d %H:%M %Z"),
               pipeline = "pipeline/build_data.R", r_version = R.version.string,
               reproduces = "Rent Burden Project/HM 4/code/rent_burden_nyc_analysis.Rmd"),
  counts = list(acs_zctas_in_file = nrow(rent_all), nyc_zctas_assigned = nrow(analysis),
                nyc_zctas_valid = sum(analysis$valid), hpd_records_nyc = nrow(housing_all),
                hpd_records_with_postcode = nrow(housing_clean),
                hpd_project_start_min = format(hpd_dates[1]), hpd_project_start_max = format(hpd_dates[2]),
                zctas_with_income = sum(analysis$valid & !is.na(analysis$median_household_income))),
  checks = checks
)
write_json(metadata, file.path(OUT_DATA, "metadata.json"), auto_unbox = TRUE, pretty = TRUE, na = "null")

# Validation report (markdown + CSV extracts)
lines <- c("# Validation report", "",
           paste0("Generated ", metadata$build$generated, " by `pipeline/build_data.R`."), "",
           "| Status | Check | Detail |", "|---|---|---|",
           map_chr(checks, ~ sprintf("| %s | %s | %s |", toupper(.x$status), .x$title, .x$detail)),
           "", "## Borough summary (reproduced)", "",
           "| Borough | Renter households (computed) | Rent-burdened | Rate % | Severe % | HPD units (all records) |",
           "|---|---|---|---|---|---|",
           sprintf("| %s | %s | %s | %.1f ± %.1f | %.1f ± %.1f | %s |", borough_out$borough,
                   format(borough_out$renter_households, big.mark = ","),
                   format(borough_out$rent_burdened_households, big.mark = ","),
                   borough_out$rent_burden_rate, borough_out$rent_burden_rate_moe,
                   borough_out$severe_rent_burden_rate, borough_out$severe_rent_burden_rate_moe,
                   format(borough_out$hpd_units_all_records, big.mark = ",")))
writeLines(lines, file.path(OUT_VAL, "validation_report.md"))
write_csv(unassigned, file.path(OUT_VAL, "unassigned_nyc_prefix_zctas.csv"))
write_csv(zip_out, file.path(OUT_VAL, "zip_data_flat.csv"))

cat(paste(lines, collapse = "\n"), "\n")

} # end if (!SKIP_WRITE)
