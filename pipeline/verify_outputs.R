# ============================================================
# Independent verification of the website data.
#
# Recomputes published numbers from the ORIGINAL raw files using base R only
# (no code shared with build_data.R) and compares them with docs/data/*.
#
# Every check has a category:
#   RECOMPUTE    independent recomputation from raw files vs published value
#   REFERENCE    published value vs Homework 4 / HW3 reference results
#                (HW4 values hand-transcribed from the saved HW4 figures; HW3 read from its derived CSV)
#   CONSISTENCY  internal consistency of the published files (no raw data involved)
#   INFO         inventory / descriptive information — NOT a validation, never counted as PASS
#
#   Rscript pipeline/verify_outputs.R
# Output: validation/independent_verification.md   (exit status 1 if any check FAILs)
# ============================================================

source("pipeline/config.local.R")
raw_dir <- file.path(RESEARCH_ROOT, "Rent Burden Project", "HM 4", "data", "raw")
hw3_dir <- file.path(RESEARCH_ROOT, "HW 3 Rent Burden", "data")
J <- function(f) jsonlite::fromJSON(file.path("docs", "data", f), simplifyVector = TRUE)

res <- data.frame(category = character(), area = character(), check = character(), status = character(), detail = character())
chk <- function(category, area, check, ok, detail = "") {
  res[nrow(res) + 1, ] <<- list(category, area, check, if (isTRUE(ok)) "PASS" else "FAIL", detail)
}
info <- function(area, check, detail) res[nrow(res) + 1, ] <<- list("INFO", area, check, "INFO", detail)
near <- function(a, b, tol) isTRUE(length(a) == length(b) && all(abs(a - b) <= tol | (is.na(a) & is.na(b))))
n <- function(x) suppressWarnings(as.numeric(x))

# ---------- raw ACS B25070 (base R) ----------
f25070 <- file.path(raw_dir, "ACSDT5Y2024.B25070-Data.csv")
r <- read.csv(f25070, skip = 2, header = FALSE, colClasses = "character")
hdr <- names(read.csv(f25070, nrows = 1, check.names = FALSE))
names(r)[seq_along(hdr)] <- hdr
r$zip <- substr(r$NAME, 7, 11)

# Borough assignment re-typed independently from the HW4 Rmd (lines 75-138)
zi <- as.integer(r$zip)
boro <- rep(NA_character_, nrow(r))
boro[(zi >= 10001 & zi <= 10040) | r$zip %in% c("10044", "10065", "10069", "10075", "10128", "10280", "10282")] <- "Manhattan"
boro[is.na(boro) & zi >= 10451 & zi <= 10475] <- "Bronx"
boro[is.na(boro) & ((zi >= 11201 & zi <= 11239) | r$zip == "11249")] <- "Brooklyn"
boro[is.na(boro) & (r$zip %in% c("11004", "11005", "11385") | (zi >= 11101 & zi <= 11109) | (zi >= 11354 & zi <= 11379) |
                      (zi >= 11411 & zi <= 11436) | (zi >= 11691 & zi <= 11697))] <- "Queens"
boro[is.na(boro) & zi >= 10301 & zi <= 10314] <- "Staten Island"
r$borough <- boro
rall <- r
r <- r[!is.na(r$borough), ]

derive <- function(d) {
  d$den <- n(d$B25070_001E) - n(d$B25070_011E)
  d$burd <- n(d$B25070_007E) + n(d$B25070_008E) + n(d$B25070_009E) + n(d$B25070_010E)
  d$sev <- n(d$B25070_010E)
  d$rate <- ifelse(d$den > 0, 100 * d$burd / d$den, NA)
  d$srate <- ifelse(d$den > 0, 100 * d$sev / d$den, NA)
  # MOE, re-implemented from the ACS handbook formulas (Understanding and Using ACS Data, 2020, ch. 8)
  d$m_num <- sqrt(n(d$B25070_007M)^2 + n(d$B25070_008M)^2 + n(d$B25070_009M)^2 + n(d$B25070_010M)^2)
  d$m_den <- sqrt(n(d$B25070_001M)^2 + n(d$B25070_011M)^2)
  pm <- function(num, mnum, den, mden) {
    p <- num / den; a <- mnum^2 - p^2 * mden^2
    ifelse(den > 0, 100 * sqrt(ifelse(a < 0, mnum^2 + p^2 * mden^2, a)) / den, NA)
  }
  d$rate_moe <- pm(d$burd, d$m_num, d$den, d$m_den)
  d$srate_moe <- pm(d$sev, n(d$B25070_010M), d$den, d$m_den)
  d$cv <- ifelse(d$rate > 0, (d$rate_moe / 1.645) / d$rate * 100, NA)
  d$rel <- ifelse(d$den <= 0, "none", ifelse(d$cv > 30, "low", ifelse(d$cv > 15, "moderate", "good")))
  d
}
r <- derive(r)

z <- J("zip_data.json"); b <- J("borough_summary.json"); st <- J("statistics.json"); meta <- J("metadata.json")
alt <- J("alternative_ranking.json"); exc <- J("excluded_zctas.json")
m <- merge(r, z, by = "zip", suffixes = c("", ".site"))
v <- z[z$renter_households > 0, ]
vr <- r[match(v$zip, r$zip), ]

# ================= RECOMPUTE: ZIP level =================
chk("RECOMPUTE", "ZIP", "Same set of ZCTAs as the HW4 ZIP rule", setequal(r$zip, z$zip), sprintf("%d raw vs %d site", nrow(r), nrow(z)))
chk("RECOMPUTE", "ZIP", "Borough of every ZCTA", all(m$borough == m$borough.site), sprintf("%d compared", nrow(m)))
chk("RECOMPUTE", "ZIP", "Renter households with computed burden (denominator)", all(m$den == m$renter_households))
chk("RECOMPUTE", "ZIP", "Total renter households", all(n(m$B25070_001E) == m$total_renter_households))
chk("RECOMPUTE", "ZIP", "Rent-burdened households", all(m$burd == m$rent_burdened_households))
chk("RECOMPUTE", "ZIP", "Severely burdened households", all(m$sev == m$severely_rent_burdened_households))
chk("RECOMPUTE", "ZIP", "Rent burden rate (±0.005, 2-dp rounding)", near(m$rate, ifelse(m$renter_households > 0, m$rent_burden_rate, NA), 0.005))
chk("RECOMPUTE", "ZIP", "Severe rate (±0.005)", near(m$srate, ifelse(m$renter_households > 0, m$severe_rent_burden_rate, NA), 0.005))
chk("RECOMPUTE", "ZIP", "90% MOE of rent burden rate (±0.005)", near(m$rate_moe[m$den > 0], m$rent_burden_rate_moe[m$den > 0], 0.005))
chk("RECOMPUTE", "ZIP", "90% MOE of severe rate (±0.005)", near(m$srate_moe[m$den > 0], m$severe_rent_burden_rate_moe[m$den > 0], 0.005))
chk("RECOMPUTE", "ZIP", "Coefficient of variation (±0.05, 1-dp rounding)", near(m$cv[m$den > 0], m$rent_burden_rate_cv[m$den > 0], 0.05))
chk("RECOMPUTE", "ZIP", "Reliability class (High/Moderate/Low/none)", all(m$rel == m$reliability),
    paste(names(table(m$rel)), table(m$rel), collapse = "; "))

# ================= RECOMPUTE: borough level =================
for (bn in c("Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island", "New York City")) {
  s <- if (bn == "New York City") r else r[r$borough == bn, ]
  row <- b[b$borough == bn, ]
  rate <- 100 * sum(s$burd) / sum(s$den); srate <- 100 * sum(s$sev) / sum(s$den)
  ok <- sum(s$den) == row$renter_households && sum(s$burd) == row$rent_burdened_households &&
    sum(s$sev) == row$severely_rent_burdened_households && abs(rate - row$rent_burden_rate) < 0.001 && abs(srate - row$severe_rent_burden_rate) < 0.001
  chk("RECOMPUTE", "Borough", paste(bn, "— counts and pooled rates"), ok,
      sprintf("%.1f%% burden, %.1f%% severe, %s renter hh", rate, srate, format(sum(s$den), big.mark = ",")))
  # borough MOE: sums via root-sum-of-squares, then proportion formula
  mn <- sqrt(sum(s$m_num^2)); md <- sqrt(sum(s$m_den^2)); p <- sum(s$burd) / sum(s$den)
  a <- mn^2 - p^2 * md^2; bm <- 100 * sqrt(if (a < 0) mn^2 + p^2 * md^2 else a) / sum(s$den)
  chk("RECOMPUTE", "Borough", paste(bn, "— 90% MOE of rate (±0.001)"), abs(bm - row$rent_burden_rate_moe) < 0.001, sprintf("±%.2f pts", bm))
}

# ================= RECOMPUTE: HPD =================
h <- read.csv(file.path(raw_dir, "Affordable_Housing_Production_by_Building_20261012.csv"), check.names = FALSE, colClasses = "character")
num2 <- function(x) { x <- gsub("[^0-9.-]", "", x); x[x == ""] <- NA; as.numeric(x) }
h$units <- num2(h$`All Counted Units`); h$rental <- num2(h$`Counted Rental Units`); h$owner <- num2(h$`Counted Homeownership Units`)
h <- h[h$Borough %in% c("Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"), ]
ok_b <- sapply(unique(h$Borough), function(bn) sum(h$units[h$Borough == bn], na.rm = TRUE) == b$hpd_units_all_records[b$borough == bn])
chk("RECOMPUTE", "HPD", "Counted units by borough (all records)", all(ok_b), paste(names(ok_b), collapse = ", "))
chk("RECOMPUTE", "HPD", "NYC counted units (all records)", sum(h$units, na.rm = TRUE) == b$hpd_units_all_records[b$borough == "New York City"],
    format(sum(h$units, na.rm = TRUE), big.mark = ","))
h$zip <- ifelse(h$Postcode == "", NA, sprintf("%05d", as.integer(h$Postcode)))
agg <- function(x) { t <- tapply(x, h$zip, sum, na.rm = TRUE); ifelse(z$zip %in% names(t), t[z$zip], 0) }
exp_units <- agg(h$units); exp_rental <- agg(h$rental); exp_owner <- agg(h$owner)
chk("RECOMPUTE", "HPD", "Counted units per ZIP (postcode match, 0 if none)", all(exp_units == z$affordable_units))
chk("RECOMPUTE", "HPD", "Rental / homeownership units per ZIP", all(exp_rental == z$affordable_rental_units & exp_owner == z$affordable_homeownership_units))
chk("RECOMPUTE", "HPD", "Units per 1,000 renter households (±0.005)",
    near(ifelse(z$renter_households > 0, 1000 * exp_units / z$renter_households, NA), z$affordable_units_per_1000, 0.005))
chk("RECOMPUTE", "HPD", "Rental units per 1,000 renter households (±0.005)",
    near(ifelse(z$renter_households > 0, 1000 * exp_rental / z$renter_households, NA), z$affordable_rental_units_per_1000, 0.005))
chk("RECOMPUTE", "HPD", "Borough units per 1,000 renter households (±0.001)",
    all(abs(b$hpd_units_all_records / b$renter_households * 1000 - b$hpd_units_per_1000_renters) < 0.001))
yr <- J("hpd_by_year.json")
chk("RECOMPUTE", "HPD", "Year series total = raw total with a start date",
    sum(yr$units) == sum(h$units[!is.na(as.Date(h$`Project Start Date`, "%m/%d/%Y"))], na.rm = TRUE))
for (k in c("New Construction", "Preservation")) {
  col <- if (k == "New Construction") "new_construction_units" else "preservation_units"
  chk("RECOMPUTE", "HPD", paste(k, "— NYC total"), sum(h$units[h$`Reporting Construction Type` == k], na.rm = TRUE) == b[[col]][b$borough == "New York City"])
}

# ================= RECOMPUTE: income =================
inc <- read.csv(file.path(raw_dir, "ACSDT5Y2024.B19013-Data.csv"), skip = 2, header = FALSE, colClasses = "character")
inc$zip <- substr(inc$V2, 7, 11)
iv <- setNames(suppressWarnings(as.numeric(inc$V3)), inc$zip)[z$zip]
chk("RECOMPUTE", "Income", "Median income = B19013 (\"250,000+\" and \"-\" → NA, as in HW4)", near(unname(iv), z$median_household_income, 0))
chk("RECOMPUTE", "Income", "Top-coded flags match the raw \"250,000+\" cells",
    setequal(z$zip[z$income_note %in% "topcoded"], inc$zip[inc$V3 == "250,000+" & inc$zip %in% z$zip]),
    paste(z$zip[z$income_note %in% "topcoded"], collapse = ", "))

# ================= RECOMPUTE: HW4 indices and lists (ranked on unrounded raw values) =================
v$rate_raw <- vr$rate
v$per1000_raw <- 1000 * exp_units[match(v$zip, z$zip)] / v$renter_households
info("Index", "Ties created by 2-dp rounding (why ranks use unrounded values)",
     sprintf("%d duplicated rounded rates vs %d unrounded", sum(duplicated(v$rent_burden_rate)), sum(duplicated(v$rate_raw))))
s1 <- rank(-v$rate_raw, ties.method = "min") + rank(v$per1000_raw, ties.method = "min")
chk("RECOMPUTE", "Index", "HW4 HPD pressure index (±0.06, 1-dp rounding)", near(100 * (max(s1) - s1) / (max(s1) - min(s1)), v$pressure_index_hpd, 0.06))
chk("RECOMPUTE", "Index", "HW4 HPD pressure top 10 (order)", identical(v$zip[order(s1, seq_along(s1))][1:10], st$top10_pressure))
vi <- v[!is.na(v$median_household_income), ]
s2 <- rank(-vi$rate_raw, ties.method = "min") + rank(vi$median_household_income, ties.method = "min")
chk("RECOMPUTE", "Index", "HW4 income pressure index (±0.06)", near(100 * (max(s2) - s2) / (max(s2) - min(s2)), vi$pressure_index_income, 0.06))
chk("RECOMPUTE", "Index", "HW4 HPD-activity top 10 (order)", identical(v$zip[order(-v$per1000_raw, seq_len(nrow(v)))][1:10], st$top10_activity))

# ================= RECOMPUTE: exploratory alternative ranking =================
keep <- vr$cv <= 30 & v$renter_households >= 1000
va <- v[keep, ]
va$rent_raw <- 1000 * exp_rental[match(va$zip, z$zip)] / va$renter_households
s3 <- rank(-va$rate_raw, ties.method = "min") + rank(va$rent_raw, ties.method = "min")
chk("RECOMPUTE", "Alternative", "Universe (CV ≤ 30% and ≥ 1,000 renter hh)", setequal(va$zip, z$zip[!is.na(z$pressure_index_alt)]),
    sprintf("%d of %d ZCTAs", nrow(va), nrow(v)))
chk("RECOMPUTE", "Alternative", "Alternative index values (±0.06)", near(100 * (max(s3) - s3) / (max(s3) - min(s3)), va$pressure_index_alt, 0.06))
chk("RECOMPUTE", "Alternative", "Alternative top 10 (order)", identical(va$zip[order(s3, seq_along(s3))][1:10], alt$top10_alt),
    paste(alt$top10_alt, collapse = ", "))

# ================= RECOMPUTE: excluded Manhattan ZCTAs =================
ex <- derive(rall[rall$zip %in% c("10162", "10279"), ])
ez <- exc$zctas
chk("RECOMPUTE", "Excluded ZCTAs", "10162/10279 counts, rates and 90% MOEs",
    all(ex$den[match(ez$zip, ex$zip)] == ez$renter_households) && near(ex$rate[match(ez$zip, ex$zip)], ez$rent_burden_rate, 0.005) &&
      near(ex$rate_moe[match(ez$zip, ex$zip)], ez$rent_burden_rate_moe, 0.005),
    paste(sprintf("%s: %.1f%% ± %.1f", ex$zip, ex$rate, ex$rate_moe), collapse = "; "))
mn_all <- rbind(r[r$borough == "Manhattan", c("den", "burd")], ex[, c("den", "burd")])
cmp_mn <- exc$comparison[exc$comparison$area == "Manhattan" & exc$comparison$version != "HW4 study population", ]
chk("RECOMPUTE", "Excluded ZCTAs", "Manhattan rate with both ZCTAs included (±0.001)",
    abs(100 * sum(mn_all$burd) / sum(mn_all$den) - cmp_mn$rent_burden_rate) < 0.001, sprintf("%.3f%%", 100 * sum(mn_all$burd) / sum(mn_all$den)))

# ================= RECOMPUTE: statistics =================
nycr <- st$income_vs_burden$r[st$income_vs_burden$group == "New York City"]
chk("RECOMPUTE", "Stats", "Income–burden Pearson r (NYC)", abs(cor(vi$median_household_income, vi$rate_raw) - nycr) < 1e-3, sprintf("r = %.3f", nycr))
chk("RECOMPUTE", "Stats", "NYC median of ZIP rent burden rates", abs(median(v$rate_raw) - st$nyc_medians$rent_burden_rate) < 0.01)

# ================= REFERENCE: Homework 4 / HW3 results =================
hw4_boro <- c(Manhattan = 47.9, Brooklyn = 50.8, Queens = 52.9, `Staten Island` = 56.8, Bronx = 60.1) # rent_burden_by_borough.png
chk("REFERENCE", "HW4", "Borough rates = labels on HW4 figure rent_burden_by_borough.png",
    all(sprintf("%.1f", b$rent_burden_rate[match(names(hw4_boro), b$borough)]) == sprintf("%.1f", hw4_boro)))
hw4_press <- c("11005" = 73.8, "11428" = 69.4, "11697" = 66.7, "10309" = 65.7, "10312" = 59.4, "11356" = 58.7,
               "11364" = 58.3, "10308" = 58.0, "11414" = 57.3, "11354" = 64.2) # top10_most_pressured_zipcodes_nyc.png
chk("REFERENCE", "HW4", "Top-10 pressure ZIPs, order and burden rates = HW4 figure",
    identical(st$top10_pressure, names(hw4_press)) && near(round(r$rate[match(names(hw4_press), r$zip)], 1), unname(hw4_press), 1e-9),
    "compared with unrounded raw rates rounded once, as in HW4")
hw4_act <- c("10475" = 1480.1, "11239" = 1360.6, "11434" = 562.6, "11692" = 518.9, "11693" = 457.6, "10004" = 446.2,
             "11691" = 435.3, "10451" = 433.2, "10474" = 416.6, "10459" = 404.3) # top10_affordable_housing_rent_burden_nyc.png
chk("REFERENCE", "HW4", "Top-10 HPD-activity ZIPs, order and units per 1,000 = HW4 figure",
    identical(st$top10_activity, names(hw4_act)) && near(round((1000 * exp_units / ifelse(z$renter_households > 0, z$renter_households, NA))[match(names(hw4_act), z$zip)], 1), unname(hw4_act), 1e-9),
    "compared with unrounded raw values rounded once, as in HW4")
hw3 <- tryCatch(read.csv(file.path(hw3_dir, "derived_rent_burden_by_zip.csv"), colClasses = c(zip_code = "character")), error = function(e) NULL)
if (!is.null(hw3)) {
  k <- match(hw3$zip_code, z$zip)
  chk("REFERENCE", "HW3", "Brooklyn burdened and valid-renter counts = HW3 derived file",
      !anyNA(k) && all(hw3$rent_burdened == z$rent_burdened_households[k] & hw3$valid_renters == z$renter_households[k]),
      sprintf("%d Brooklyn ZCTAs", nrow(hw3)))
}

# ================= CONSISTENCY: published files =================
chk("CONSISTENCY", "ZIP", "No duplicate ZIPs", !any(duplicated(z$zip)))
chk("CONSISTENCY", "ZIP", "Brackets sum to burdened households", all(z$rent_30_34 + z$rent_35_39 + z$rent_40_49 + z$rent_50_plus == z$rent_burdened_households))
chk("CONSISTENCY", "ZIP", "Severe rate ≤ total rate; rates within 0–100",
    all(z$severe_rent_burden_rate <= z$rent_burden_rate + 1e-9 & z$rent_burden_rate >= 0 & z$rent_burden_rate <= 100, na.rm = TRUE))
chk("CONSISTENCY", "ZIP", "ZCTAs without computed renters carry reliability 'none'", all(z$reliability[z$renter_households <= 0] == "none"),
    paste(z$zip[z$renter_households <= 0], collapse = ", "))
chk("CONSISTENCY", "Alternative", "Excluded ZCTAs carry a reason and no alternative index",
    all(is.na(z$pressure_index_alt) == !is.na(z$alt_exclusion)))
chk("CONSISTENCY", "Excluded ZCTAs", "10162/10279 absent from ZIP data, totals and rankings",
    !any(c("10162", "10279") %in% c(z$zip, st$top10_pressure, st$top10_activity, alt$top10_alt)))
g <- jsonlite::fromJSON("docs/data/zcta_nyc.geojson", simplifyVector = FALSE)
gz <- vapply(g$features, function(f) f$properties$zip, "")
gx <- vapply(g$features, function(f) isTRUE(f$properties$excluded), TRUE)
gb <- vapply(g$features, function(f) f$properties$borough, "")
chk("CONSISTENCY", "Geo", "One polygon per analysed ZCTA (+ 2 flagged excluded)", setequal(gz[!gx], z$zip) && setequal(gz[gx], c("10162", "10279")) && !any(duplicated(gz)))
chk("CONSISTENCY", "Geo", "Polygon borough = data borough", all(gb[!gx] == z$borough[match(gz[!gx], z$zip)]))
chk("CONSISTENCY", "Geo", "All coordinates within the NYC bounding box",
    all(vapply(g$features, function(f) { cc <- matrix(unlist(f$geometry$coordinates), ncol = 2, byrow = TRUE)
      all(cc[, 1] > -74.3 & cc[, 1] < -73.65 & cc[, 2] > 40.45 & cc[, 2] < 40.95) }, TRUE)))

# ================= INFO =================
zcount <- table(z$borough[z$renter_households > 0])
info("ZIP", "ZCTAs with computable rates by borough", paste(names(zcount), zcount, collapse = "; "))
info("Data", "Build checked", meta$build$generated)

# ---------- report ----------
val <- res[res$status != "INFO", ]
by_cat <- sapply(c("RECOMPUTE", "REFERENCE", "CONSISTENCY"), function(k) sprintf("%s %d/%d", k, sum(val$category == k & val$status == "PASS"), sum(val$category == k)))
lines <- c("# Independent verification", "",
           sprintf("Generated %s by `pipeline/verify_outputs.R` (base R; shares no code with the build pipeline).", format(Sys.time(), "%Y-%m-%d %H:%M")),
           sprintf("Data build checked: %s. Raw inputs: original HW4 files (read-only).", meta$build$generated), "",
           sprintf("**Validation checks: %d PASS, %d FAIL** (%s). Informational lines: %d (not counted).",
                   sum(val$status == "PASS"), sum(val$status == "FAIL"), paste(by_cat, collapse = "; "), sum(res$status == "INFO")),
           sprintf("**Independent statistical validations** (RECOMPUTE + REFERENCE): %d of %d pass.",
                   sum(val$category %in% c("RECOMPUTE", "REFERENCE") & val$status == "PASS"), sum(val$category %in% c("RECOMPUTE", "REFERENCE"))), "",
           "Categories: **RECOMPUTE** = recomputed from raw files with separate code; **REFERENCE** = compared with Homework 4 figure values (hand-transcribed) or the HW3 derived file; **CONSISTENCY** = internal checks of the published files; **INFO** = descriptive, not a validation.", "",
           "| Category | Area | Check | Result | Detail |", "|---|---|---|---|---|",
           sprintf("| %s | %s | %s | %s | %s |", res$category, res$area, res$check, res$status, res$detail))
writeLines(lines, "validation/independent_verification.md")
cat(paste(lines, collapse = "\n"), "\n")
if (any(res$status == "FAIL")) quit(status = 1)
