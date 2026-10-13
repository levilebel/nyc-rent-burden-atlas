# Independent R reference for the policy simulator (docs/assets/js/sim.js).
# Recomputes three scenarios from the RAW files (via build_data.R with SKIP_WRITE) with no code
# shared with the JavaScript engine. Compare with the browser engine as described in
# validation/simulation_crosscheck.md.
# Run from the project root: Rscript pipeline/simulation_reference.R
SKIP_WRITE <- TRUE
suppressMessages(source("pipeline/build_data.R"))   # gives `analysis` built from raw files (unrounded)
v <- analysis[analysis$valid, ]
idx <- function(act) {
  rb <- rank(-v$rent_burden_rate, ties.method = "min"); la <- rank(act, ties.method = "min")
  s <- rb + la; list(index = 100 * (max(s) - s) / (max(s) - min(s)), score = s)
}
base <- idx(v$affordable_units_per_1000)
ord <- order(base$score, seq_along(base$score))
scen <- list(
  top10_25 = list(delta = 25, targets = v$zipcode[ord][1:10]),
  zero_50  = list(delta = 50, targets = v$zipcode[v$affordable_units == 0]),
  bronx_10 = list(delta = 10, targets = v$zipcode[v$borough == "Bronx"])
)
out <- lapply(scen, function(s) {
  act <- v$affordable_units_per_1000 + ifelse(v$zipcode %in% s$targets, s$delta, 0)
  p <- idx(act)
  list(delta = s$delta, n = length(s$targets), after = setNames(as.list(round(p$index, 6)), v$zipcode),
       top10 = v$zipcode[order(p$score, seq_along(p$score))][1:10],
       implied = sum(s$delta * v$rent_burden_denominator[v$zipcode %in% s$targets] / 1000))
})
jsonlite::write_json(out, "validation/simulation_reference.json", auto_unbox = TRUE, digits = NA)
cat("ok\n")
