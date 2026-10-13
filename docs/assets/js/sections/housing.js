// Section D — Affordable housing production (NYC HPD) and its relation to rent burden.
/* global d3 */
import { fmt, COLORS, onResize, onTheme, tipRows, legend, relText, moeText, uncertaintyRows, uncertaintyWarning, joinNotes } from "../util.js";
import { stackedH, stackedColumns, scatter, hBars } from "../charts.js";

// Colours are getters so they follow the active theme at draw time.
const TYPES = [
  { key: "new_construction_units", type: "New Construction", label: "New construction", get color() { return COLORS.nc; } },
  { key: "preservation_units", type: "Preservation", label: "Preservation", get color() { return COLORS.pres; } },
];
// HPD income bands (share of Area Median Income); lowest income has the strongest colour; "Other" is grey.
const BANDS = [
  ["extremely_low_income_units", "Extremely low (≤30% AMI)"],
  ["very_low_income_units", "Very low (31–50%)"],
  ["low_income_units", "Low (51–80%)"],
  ["moderate_income_units", "Moderate (81–120%)"],
  ["middle_income_units", "Middle (121–165%)"],
  ["other_income_units", "Other"],
].map(([key, label], i) => ({ key, label, get color() { return COLORS.bands[i]; } }));

export function init({ boroughSummary, zipData, hpdYear, stats, meta, altRanking, BOROUGHS, store }) {
  const nyc = boroughSummary["New York City"];
  const order = [...BOROUGHS].sort((a, b) => boroughSummary[b].hpd_units_all_records - boroughSummary[a].hpd_units_all_records);
  const lowInc = nyc.extremely_low_income_units + nyc.very_low_income_units;
  const bandTotal = d3.sum(BANDS, (b) => nyc[b.key]);

  document.getElementById("hpd-kpis").innerHTML = [
    { label: "Counted affordable units", value: fmt.int(nyc.hpd_units_all_records), note: `${fmt.int(nyc.hpd_records)} building records, 5 boroughs` },
    { label: "New construction share", value: fmt.pct(nyc.new_construction_units / nyc.hpd_units_all_records * 100), note: `${fmt.int(nyc.new_construction_units)} units; the rest are preservation` },
    { label: "Extremely + very low income", value: fmt.pct(lowInc / bandTotal * 100), note: `${fmt.int(lowInc)} units at ≤50% AMI` },
    { label: "Project start dates", value: `${meta.counts.hpd_project_start_min.slice(0, 4)}–${meta.counts.hpd_project_start_max.slice(0, 4)}`, note: `Latest start ${meta.counts.hpd_project_start_max}` },
  ].map((k) => `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="note">${k.note}</div></div>`).join("");

  // --- units by borough & type
  onTheme(() => legend(document.getElementById("hpd-type-legend"), TYPES));
  const typeEl = document.getElementById("hpd-type-chart");
  onResize(typeEl, (w) => stackedH(typeEl, {
    width: w, series: TYPES, fmt: {}, xTitle: "counted affordable units", ariaLabel: "HPD counted units by borough and construction type",
    totalLabel: (r, t) => fmt.compact(t),
    rows: order.map((b) => {
      const s = boroughSummary[b];
      return {
        label: b, segs: TYPES.map((t) => ({ key: t.key, value: s[t.key] })),
        tip: (seg) => tipRows(`${b} · ${TYPES.find((t) => t.key === seg.key).label}`, [
          ["Units", fmt.int(seg.value)],
          ["Share of borough total", fmt.pct(seg.value / s.hpd_units_all_records * 100)],
          ["Borough total", fmt.int(s.hpd_units_all_records)],
          ["Per 1,000 renter households", fmt.dec(s.hpd_units_per_1000_renters)],
        ]),
      };
    }),
  }));

  // --- units by income band (100% stacked)
  onTheme(() => legend(document.getElementById("hpd-income-legend"), BANDS));
  const incEl = document.getElementById("hpd-income-chart");
  onResize(incEl, (w) => stackedH(incEl, {
    width: w, series: BANDS, xMax: 100, fmt: { axis: (v) => `${v}%` }, xTitle: "% of borough's counted units",
    ariaLabel: "Share of HPD counted units by income band and borough",
    rows: ["New York City", ...order].map((b) => {
      const s = boroughSummary[b];
      const tot = d3.sum(BANDS, (x) => s[x.key]);
      return {
        label: b, segs: BANDS.map((x) => ({ key: x.key, value: s[x.key] / tot * 100, n: s[x.key] })),
        tip: (seg) => tipRows(`${b} · ${BANDS.find((x) => x.key === seg.key).label}`, [["Share", fmt.pct(seg.value)], ["Units", fmt.int(seg.n)]]),
      };
    }),
  }));

  // --- by project start year
  const yearSel = document.getElementById("hpd-year-borough");
  yearSel.insertAdjacentHTML("beforeend", BOROUGHS.map((b) => `<option>${b}</option>`).join(""));
  onTheme(() => legend(document.getElementById("hpd-year-legend"), [...TYPES, { label: "Faded column: partial year", color: d3.color(COLORS.nc).copy({ opacity: 0.45 }).formatRgb() }]));
  const lastYear = +meta.counts.hpd_project_start_max.slice(0, 4);
  const yEl = document.getElementById("hpd-year-chart");
  function drawYears(w) {
    const boro = yearSel.value;
    const years = d3.range(+meta.counts.hpd_project_start_min.slice(0, 4), lastYear + 1);
    const rows = years.map((y) => ({
      x: String(y),
      segs: TYPES.map((t) => ({ key: t.key, value: d3.sum(hpdYear.filter((r) => r.year === y && r.type === t.type && (boro === "all" || r.borough === boro)), (r) => r.units) })),
    }));
    document.getElementById("hpd-year-source").textContent =
      `Year = project start date. ${lastYear} is partial (latest start ${meta.counts.hpd_project_start_max}). Recent projects may be added or revised in later HPD releases. Source: NYC HPD (export 2026-10-12).`;
    stackedColumns(yEl, {
      rows, series: TYPES, width: w, yTitle: "counted units", ariaLabel: `HPD counted units by project start year, ${boro === "all" ? "all boroughs" : boro}`,
      partial: (r) => +r.x === lastYear,
      tip: (r) => tipRows(`${r.x}${+r.x === lastYear ? " (partial)" : ""} · ${boro === "all" ? "NYC" : boro}`, [
        ...r.segs.map((s) => [TYPES.find((t) => t.key === s.key).label, fmt.int(s.value)]),
        ["Total", fmt.int(d3.sum(r.segs, (s) => s.value))],
      ]),
    });
  }
  yearSel.addEventListener("change", () => drawYears(yEl.clientWidth));
  onResize(yEl, drawYears);

  // --- production intensity vs rent burden
  const scSel = document.getElementById("hpd-scatter-borough");
  scSel.insertAdjacentHTML("beforeend", BOROUGHS.map((b) => `<option>${b}</option>`).join(""));
  const assoc = Object.fromEntries(stats.hpd_vs_burden.map((a) => [a.group, a]));
  const scEl = document.getElementById("hpd-scatter");
  function drawScatter(w) {
    const boro = scSel.value;
    const a = assoc[boro === "all" ? "New York City" : boro];
    const { selected } = store.get();
    document.getElementById("hpd-scatter-sub").innerHTML =
      `${boro === "all" ? "New York City" : boro}: Pearson <em>r</em> = ${a.r.toFixed(2)}, Spearman ρ = ${a.spearman.toFixed(2)} (n = ${a.n}).
       A correlation here describes where HPD has been active, not whether production changes burden.`;
    scatter(scEl, {
      width: w, xType: "sqrt", xTitle: "HPD units per 1,000 renter households (√ scale)", yTitle: "Rent burden rate (%)",
      xFmt: d3.format(",.0f"), yFmt: (v) => `${v}%`, ariaLabel: "Scatter plot of HPD affordable units per 1,000 renter households versus rent burden by ZIP",
      medians: { x: stats.nyc_medians.affordable_units_per_1000, y: stats.nyc_medians.rent_burden_rate },
      data: zipData.filter((z) => z.renter_households > 0).map((z) => ({
        x: z.affordable_units_per_1000, y: z.rent_burden_rate, id: z.zip,
        active: boro === "all" || z.borough === boro, selected: selected.includes(z.zip),
        tip: tipRows(`ZIP ${z.zip} · ${z.borough}`, [["Units / 1,000 renters", fmt.dec(z.affordable_units_per_1000)], ["HPD units (count)", fmt.int(z.affordable_units)], ["Rent burden rate (est.)", fmt.pct(z.rent_burden_rate)],
          ...uncertaintyRows({ moe: z.rent_burden_rate_moe, cv: z.rent_burden_rate_cv, cls: z.reliability })], joinNotes(uncertaintyWarning(z.reliability), "Click to select")),
      })),
      onClick: (d) => store.toggle(d.id),
    });
  }
  scSel.addEventListener("change", () => drawScatter(scEl.clientWidth));
  onResize(scEl, drawScatter);
  store.subscribe(() => drawScatter(scEl.clientWidth));

  // --- Rankings: HW4 baseline (unchanged), exploratory alternative, HW4 activity top 10
  const rankEl = document.getElementById("rank-chart");
  const changesEl = document.getElementById("rank-changes");
  const tabs = [...document.querySelectorAll(".tabs [data-tab]")];
  let tab = "pressure";
  const byZip = new Map(zipData.map((z) => [z.zip, z]));
  const nBase = zipData.filter((z) => z.pressure_index_hpd != null).length;
  const zeroHpd = zipData.filter((z) => z.renter_households > 0 && z.affordable_units === 0).length;
  const PERIODS = "Rent burden: ACS 2024 5-year survey estimates (2020–2024). HPD: administrative counts for projects started 2014 – mid-2026. ZCTAs approximate USPS ZIP codes. A high score describes high burden alongside little recorded HPD activity; it does not show that one causes the other.";

  // Visible caption under each bar: sample size, 90% MOE, reliability — and a ⚠ for uncertain estimates.
  const uncertaintyNote = (z) => {
    const small = z.renter_households < 1000;
    const warn = z.reliability === "low" || small;
    const parts = [`${fmt.int(z.renter_households)} renter hh (est.)`, `burden ${fmt.pct(z.rent_burden_rate)} ${moeText(z.rent_burden_rate_moe)}`,
      `${relText(z.reliability)} reliability`];
    if (small) parts.push("small sample");
    return { note: parts.join(" · "), warn };
  };
  const rankTip = (z, mode) => tipRows(`ZIP ${z.zip} · ${z.borough}`, [
    ["Rent burden rate (est.)", `${fmt.pct(z.rent_burden_rate)} ± ${fmt.dec(z.rent_burden_rate_moe)}`],
    ["90% margin of error (MOE)", `± ${fmt.dec(z.rent_burden_rate_moe)} pts`],
    ["Reliability", `${relText(z.reliability)} (CV ${fmt.dec(z.rent_burden_rate_cv)}%)`],
    ["Renter households (est.)", fmt.int(z.renter_households)],
    ["HPD units, all (count)", fmt.int(z.affordable_units)],
    ["…rental / homeownership", `${fmt.int(z.affordable_rental_units)} / ${fmt.int(z.affordable_homeownership_units)}`],
    mode === "alt"
      ? ["Rental units / 1,000 renters", fmt.dec(z.affordable_rental_units_per_1000)]
      : ["Units / 1,000 renters", fmt.dec(z.affordable_units_per_1000)],
    mode === "alt"
      ? ["Alternative index · ranks", `${fmt.dec(z.pressure_index_alt)} · ${z.idx_alt_burden_rank} / ${z.idx_alt_activity_rank} of ${z.idx_alt_n}`]
      : mode === "pressure" && ["HW4 index · ranks", `${fmt.dec(z.pressure_index_hpd)} · ${z.idx_hpd_burden_rank} / ${z.idx_hpd_activity_rank} of ${z.idx_hpd_n}`],
  ], joinNotes(uncertaintyWarning(z.reliability), "± = 90% MOE"));

  function drawChanges() {
    if (tab === "activity") { changesEl.innerHTML = ""; return; }
    const rows = [...altRanking.baseline_top10.map((r) => ({ zip: r.zip, base: r.baseline_rank, alt: r.alt_rank, excl: r.alt_exclusion })),
      ...altRanking.alt_top10.filter((r) => r.baseline_rank > 10).map((r) => ({ zip: r.zip, base: r.baseline_rank, alt: r.alt_rank, excl: null }))];
    const reason = (r, z) => {
      if (r.excl) return `Excluded: ${r.excl}`;
      if (r.base > 10) return z.affordable_homeownership_units > 0
        ? `Enters: rental-only activity is lower (${fmt.dec(z.affordable_rental_units_per_1000)} vs ${fmt.dec(z.affordable_units_per_1000)} per 1,000; ${fmt.int(z.affordable_homeownership_units)} homeownership units removed)`
        : "Enters: ZIPs above it were excluded";
      if (r.alt === null || r.alt === undefined) return "";
      return r.alt === r.base ? "Same rank" : `Moves ${r.base} → ${r.alt}`;
    };
    changesEl.innerHTML = `
      <h4 class="card-title" style="font-size:.95rem;margin-top:14px">How the alternative criteria change the top 10</h4>
      <p class="card-sub">${altRanking.overlap} of 10 ZIPs appear in both lists. The alternative ranks ${altRanking.n_alt} of ${altRanking.n_baseline} ZCTAs: it drops
        ${altRanking.excluded.length} ZIPs with CV &gt; ${altRanking.criteria.max_cv}% or fewer than ${fmt.int(altRanking.criteria.min_renter_households)} renter households
        (${altRanking.excluded.map((e) => e.zip).join(", ")}) and counts HPD <em>rental</em> units only.</p>
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th scope="col">ZIP</th><th scope="col">HW4 rank</th><th scope="col">Alt. rank</th><th scope="col" class="l">What changed</th></tr></thead>
        <tbody>${rows.map((r) => { const z = byZip.get(r.zip); return `<tr><td>${r.zip} · ${z.borough}</td><td>${r.base}</td><td>${r.alt ?? "—"}</td><td class="l">${reason(r, z)}</td></tr>`; }).join("")}</tbody>
      </table></div>`;
  }

  function drawRank(w) {
    const mode = tab;
    const ids = mode === "pressure" ? stats.top10_pressure : mode === "alt" ? altRanking.top10_alt : stats.top10_activity;
    const data = ids.map((id) => byZip.get(id)).map((z) => {
      const u = mode === "activity"
        ? { note: `${fmt.int(z.renter_households)} renter hh (est.) · ${fmt.int(z.affordable_units)} counted units (admin count)`, warn: z.renter_households < 1000 }
        : uncertaintyNote(z);
      return {
        label: `${z.zip} · ${z.borough}`,
        value: mode === "pressure" ? z.pressure_index_hpd : mode === "alt" ? z.pressure_index_alt : z.affordable_units_per_1000,
        note: u.note, warn: u.warn, tip: rankTip(z, mode),
      };
    });
    hBars(rankEl, {
      data, width: w, fmt: (v) => fmt.dec(v),
      ariaLabel: mode === "pressure" ? "Top 10 ZIPs by the HW4 baseline pressure index" : mode === "alt" ? "Top 10 ZIPs by the exploratory alternative ranking" : "Top 10 ZIPs by HPD units per 1,000 renter households",
      xTitle: mode === "activity" ? "HPD units per 1,000 renter households" : "relative index (0–100)",
    });
    const zeroAlt = altRanking.top10_alt.filter((id) => byZip.get(id).affordable_rental_units === 0).length;
    document.getElementById("rank-note").innerHTML = mode === "pressure"
      ? `<strong>HW4 baseline — custom, exploratory, relative research indicator; not an official statistic.</strong> Ranked among ${nBase} ZCTAs:
         (rank of rent burden, high→low) + (rank of HPD units per 1,000 renters, low→high), rescaled 0–100. ${zeroHpd} ZIPs have no HPD units and tie at the lowest-activity rank;
         9 of these 10 are among them, so their order mostly reflects rent burden. ⚠ marks small samples or Low reliability. ${PERIODS}`
      : mode === "alt"
        ? `<strong>Exploratory alternative — not part of Homework 4 and not an official statistic.</strong> Same formula as HW4, ranked among ${altRanking.n_alt} ZCTAs
           with reliable estimates (CV ≤ ${altRanking.criteria.max_cv}% and ≥ ${fmt.int(altRanking.criteria.min_renter_households)} renter households), using HPD <em>rental</em> units only.
           ${zeroAlt} of these 10 have zero rental units recorded. ${PERIODS}`
        : `HW4 top 10 by HPD counted units (new construction + preservation, rental + homeownership) per 1,000 renter households. High values can reflect a few large projects in a ZIP with relatively few renters. ${PERIODS}`;
    drawChanges();
  }
  // ARIA tabs: click/Enter/Space select; Left/Right/Home/End move between tabs (roving tabindex).
  const selectTab = (b, focus) => {
    tab = b.dataset.tab;
    tabs.forEach((t) => { t.setAttribute("aria-selected", String(t === b)); t.tabIndex = t === b ? 0 : -1; t.setAttribute("aria-controls", "rank-chart"); });
    if (focus) b.focus();
    drawRank(rankEl.clientWidth);
  };
  tabs.forEach((b, i) => {
    b.tabIndex = b.getAttribute("aria-selected") === "true" ? 0 : -1;
    b.addEventListener("click", () => selectTab(b, false));
    b.addEventListener("keydown", (e) => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      selectTab(tabs[(k + tabs.length) % tabs.length], true);
    });
  });
  onResize(rankEl, drawRank);
}
