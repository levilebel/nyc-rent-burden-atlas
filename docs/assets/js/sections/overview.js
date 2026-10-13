// Section A — Overview: headline figure, KPI tiles, burden-bracket composition.
/* global d3 */
import { fmt, BRACKETS, legend, onResize, onTheme, tipRows } from "../util.js";
import { stackedH } from "../charts.js";

export function init({ boroughSummary, zipData, BOROUGHS }) {
  const nyc = boroughSummary["New York City"];
  const worst = BOROUGHS.map((b) => boroughSummary[b]).sort((a, b) => b.rent_burden_rate - a.rent_burden_rate)[0];

  document.getElementById("hero-figure").innerHTML = `
    <div class="big">${nyc.rent_burden_rate.toFixed(1)}<small>%</small></div>
    <p class="explain">of New York City renter households — <strong>${fmt.int(nyc.rent_burdened_households)}</strong> of
      ${fmt.int(nyc.renter_households)} — spend <strong>30% or more</strong> of household income on gross rent
      (±${nyc.rent_burden_rate_moe.toFixed(1)} pts, 90% MOE). ACS 2020–2024 five-year estimates, ${nyc.zip_count_valid} ZCTAs.</p>`;

  const kpis = [
    { label: "Severely rent-burdened", value: fmt.pct(nyc.severe_rent_burden_rate), note: `${fmt.int(nyc.severely_rent_burdened_households)} households pay ≥50% of income` },
    { label: "Highest borough rate", value: `${worst.borough} ${fmt.pct(worst.rent_burden_rate)}`, note: `±${worst.rent_burden_rate_moe.toFixed(1)} pts (90% MOE)` },
    { label: "Renter households analysed (est.)", value: fmt.compact(nyc.renter_households), note: `${fmt.int(nyc.total_renter_households - nyc.renter_households)} more with burden "not computed"` },
    { label: "HPD counted affordable units", value: fmt.compact(nyc.hpd_units_all_records), note: "Administrative count; projects started 2014 – mid-2026 (new construction + preservation)" },
  ];
  document.getElementById("kpis").innerHTML = kpis.map((k) =>
    `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="note">${k.note}</div></div>`).join("");

  // Bracket shares per borough, computed by pooling ZCTA counts.
  const groups = ["New York City", ...BOROUGHS];
  const rows = groups.map((g) => {
    const zs = zipData.filter((z) => (g === "New York City" || z.borough === g) && z.renter_households > 0);
    const den = d3.sum(zs, (z) => z.renter_households);
    const segs = BRACKETS.map((b) => ({ key: b.key, count: d3.sum(zs, (z) => z[b.key]), value: d3.sum(zs, (z) => z[b.key]) / den * 100 }));
    return {
      label: g, den, segs,
      tip: (s, row) => tipRows(`${row.label} · ${BRACKETS.find((b) => b.key === s.key).label} of income`, [
        ["Share of renter households", fmt.pct(s.value)],
        ["Households", fmt.int(s.count)],
        ["All brackets ≥30%", fmt.pct(d3.sum(row.segs, (q) => q.value))],
      ]),
    };
  }).sort((a, b) => (a.label === "New York City" ? -1 : b.label === "New York City" ? 1 : d3.sum(b.segs, (s) => s.value) - d3.sum(a.segs, (s) => s.value)));

  onTheme(() => legend(document.getElementById("bracket-legend"), BRACKETS.map((b) => ({ label: b.label, color: b.color }))));
  const el = document.getElementById("bracket-chart");
  onResize(el, (w) => stackedH(el, {
    rows, series: BRACKETS.map((b) => ({ key: b.key, color: b.color })), width: w,
    fmt: { axis: (v) => `${v}%` }, xMax: 70, xTitle: "% of renter households",
    ariaLabel: "Stacked bars of rent burden brackets by borough",
    totalLabel: (r, t) => fmt.pct(t),
  }));
}
