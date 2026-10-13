# ============================================================
# Review of the HW4 "Affordability Pressure Index" (HPD version)
# Read-only diagnostics and sensitivity tests. Does NOT change the index.
#
#   Rscript pipeline/review_pressure_index.R
# Output: validation/pressure_index_review.md
# ============================================================

SKIP_WRITE <- TRUE
source("pipeline/build_data.R")

v <- analysis %>% filter(valid) %>%
  mutate(rb_rank = min_rank(desc(rent_burden_rate)), la_rank = min_rank(affordable_units_per_1000),
         score = rb_rank + la_rank)
N <- nrow(v)
idx <- function(s) 100 * (max(s) - s) / (max(s) - min(s))
top10 <- function(df, s) df$zipcode[order(s, seq_along(s))][1:10]
base_top <- top10(v, v$score)
overlap <- function(t) sum(t %in% base_top)

out <- character(); say <- function(...) out <<- c(out, sprintf(...))
f1 <- function(x) formatC(x, format = "f", digits = 1); f2 <- function(x) formatC(x, format = "f", digits = 2)

zero <- v %>% filter(affordable_units == 0)
say("# Review: HW4 Affordability Pressure Index (rent burden + HPD activity)")
say("")
say("Generated %s by `pipeline/review_pressure_index.R`. **Diagnostics only — the published index is unchanged.**", format(Sys.time(), "%Y-%m-%d %H:%M"))
say("")
say("## 1. Exact definition (from HW4 Rmd, reproduced in build_data.R)")
say("")
say("1. Universe: the %d ZCTAs with `rent_burden_denominator > 0`.", N)
say("2. `rent_burden_rank = min_rank(desc(rent_burden_rate))`: 1 = highest burden.")
say("3. `low_affordable_rank = min_rank(affordable_units_per_1000)`: 1 = fewest HPD units per 1,000 renter households.")
say("4. `priority_score = rent_burden_rank + low_affordable_rank`: equal implicit weights, on the rank scale.")
say("5. `index = 100 × (max(score) − score) / (max(score) − min(score))`: min–max rescaled to 0–100, 100 = most pressured.")
say("")
say("Properties: ordinal only (magnitudes discarded); relative to the set of ZCTAs (adding/removing ZCTAs changes every value); ties use the minimum rank; no adjustment for sampling error; components are a 2020–2024 household condition and a 2014–2026 policy flow.")
say("")
say("## 2. Diagnostics")
say("")
say("- **Ties at zero activity:** %d of %d ZCTAs have 0 HPD units and all receive `low_affordable_rank = 1`. The next ZCTA receives rank %d. Being a zero-activity ZIP therefore guarantees the best possible activity rank, and these %d ZIPs make up %d of the top 10.",
    nrow(zero), N, nrow(zero) + 1, nrow(zero), sum(base_top %in% zero$zipcode))
say("- **Which component drives the index?** Spearman correlation of the index with the burden rank: %s; with the low-activity rank: %s.",
    f2(cor(v$score, v$rb_rank, method = "spearman")), f2(cor(v$score, v$la_rank, method = "spearman")))
say("- **Size and reliability:** Spearman correlation between the index and renter households: %s. Among the top 10, the smallest ZCTAs are %s.",
    f2(cor(idx(v$score), v$rent_burden_denominator, method = "spearman")),
    paste(v %>% filter(zipcode %in% base_top) %>% arrange(rent_burden_denominator) %>% slice_head(n = 3) %>%
            transmute(s = sprintf("%s (%s renter hh, ±%s pts)", zipcode, format(rent_burden_denominator, big.mark = ","), f1(rent_burden_rate_moe))) %>% pull(s), collapse = ", "))
say("- **Production denominator mixes tenure:** units per 1,000 *renter* households include %s homeownership units citywide (%s%% of ZIP-matched counted units).",
    format(sum(v$affordable_homeownership_units), big.mark = ","), f1(100 * sum(v$affordable_homeownership_units) / sum(v$affordable_units)))
say("- **Causality:** the index combines a condition (burden) with a policy flow (production). A high score means *high burden and comparatively little recorded HPD activity*. It does **not** show that low production caused high burden, or that more production would lower it.")
say("")
say("## 3. Sensitivity of the top 10 (published order: %s)", paste(base_top, collapse = ", "))
say("")
say("| Variant | Top 10 | Overlap with published | Spearman ρ with published index |")
say("|---|---|---|---|")
variant <- function(label, df, s) {
  t <- top10(df, s)
  common <- intersect(df$zipcode, v$zipcode)
  rho <- cor(idx(s)[match(common, df$zipcode)], idx(v$score)[match(common, v$zipcode)], method = "spearman")
  say("| %s | %s | %d/10 | %s |", label, paste(t, collapse = ", "), overlap(t), f2(rho))
}
variant("Average ranks for ties (instead of minimum)", v, rank(-v$rent_burden_rate) + rank(v$affordable_units_per_1000))
rel <- v %>% filter(rent_burden_rate_cv <= 30)
variant(sprintf("Exclude CV > 30%% (n = %d)", nrow(rel)), rel,
        min_rank(desc(rel$rent_burden_rate)) + min_rank(rel$affordable_units_per_1000))
big <- v %>% filter(rent_burden_denominator >= 1000)
variant(sprintf("Exclude ZCTAs with < 1,000 renter hh (n = %d)", nrow(big)), big,
        min_rank(desc(big$rent_burden_rate)) + min_rank(big$affordable_units_per_1000))
variant("Rental units only (exclude homeownership)", v,
        min_rank(desc(v$rent_burden_rate)) + min_rank(v$affordable_rental_units / v$rent_burden_denominator))
variant("Burden weighted 2:1 over activity", v, 2 * v$rb_rank + v$la_rank)
zs <- function(x) (x - mean(x)) / sd(x)
variant("Standardised values (z-scores) instead of ranks", v, -(zs(v$rent_burden_rate) - zs(sqrt(v$affordable_units_per_1000))))
say("")
say("## 4. Recommendations (require approval before any change)")
say("")
say("1. **Label** it everywhere as a *custom research index from Homework 4*, not an official statistic. Show both component ranks in tooltips. *(Wording only. Implemented, since it does not change any value.)*")
say("2. **Reliability screen:** exclude or visually de-emphasise ZCTAs with CV > 30%% (or < 1,000 renter households) from the ranking. See section 3 for the effect on the top 10.")
say("3. **Tie handling:** use average ranks so the 22 zero-activity ZIPs do not all receive the extreme rank of 1.")
say("4. **Tenure consistency:** rank on HPD *rental* units per 1,000 renter households, so the numerator and denominator refer to the same population.")
say("5. **Rename** to something descriptive and non-causal, e.g. *“Burden–production gap rank”*. “Pressure” can be read as a measure of need or causation.")
say("6. Keep the index **relative**: present it as a ranking or percentile, not as a 0–100 level that could be compared across datasets or years.")

writeLines(out, "validation/pressure_index_review.md")
cat(paste(out, collapse = "\n"), "\n")
