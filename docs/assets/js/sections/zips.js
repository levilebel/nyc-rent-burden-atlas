// Section C — ZIP code explorer: choropleth, search, detail panel, comparison, scatter, table.
/* global d3 */
import { fmt, METRICS, seq, COLORS, onResize, tipRows, bindTip, uncertaintyRows, uncertaintyWarning, joinNotes, reliabilityClass, cvOf, relText } from "../util.js";
import { stackedH, scatter } from "../charts.js";

// MOE + reliability rows for a ZIP's rent burden rate (existing pipeline classes; none for ZIPs without a rate).
const zipUnc = (z) => (z && z.renter_households > 0
  ? uncertaintyRows({ moe: z.rent_burden_rate_moe, cv: z.rent_burden_rate_cv, cls: z.reliability }) : []);
// ZIP 10463 includes Marble Hill: legally part of Manhattan (New York County) but on the Bronx mainland.
const MARBLE_HILL = "ZIP 10463 includes Marble Hill, which is legally part of Manhattan (New York County) but lies on the Bronx mainland. HW4 assigns the whole ZIP to the Bronx; HPD lists 5 of its buildings under Manhattan.";

const MAP_METRICS = ["rent_burden_rate", "severe_rent_burden_rate", "affordable_units_per_1000", "median_household_income",
  "pressure_index_hpd", "pressure_index_alt", "pressure_index_income", "renter_households"];

// d3-geo expects clockwise exterior rings; RFC 7946 files are counter-clockwise. Flip any feature whose area exceeds a hemisphere.
function rewind(fc) {
  fc.features.forEach((f) => {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    polys.forEach((rings) => {
      const test = { type: "Polygon", coordinates: [rings[0]] };
      if (d3.geoArea(test) > 2 * Math.PI) rings.forEach((r) => r.reverse());
    });
  });
  return fc;
}

export function init(ctx) {
  const { zipData, zipIndex, stats, zcta, outlines, store, BOROUGHS, excluded } = ctx;
  const excludedIndex = new Map(excluded.zctas.map((e) => [e.zip, e]));
  rewind(zcta); rewind(outlines);

  const metricSel = document.getElementById("zip-metric");
  const boroSel = document.getElementById("zip-borough");
  const search = document.getElementById("zip-search");
  metricSel.innerHTML = MAP_METRICS.map((k) => `<option value="${k}">${METRICS[k].label}</option>`).join("");
  boroSel.insertAdjacentHTML("beforeend", BOROUGHS.map((b) => `<option>${b}</option>`).join(""));
  document.getElementById("zip-list").innerHTML = zipData.map((z) => `<option value="${z.zip}">${z.zip} · ${z.borough}</option>`).join("");

  const valueOf = (z, key) => {
    if (!z || z.renter_households <= 0) return null;
    const v = z[key];
    return v == null ? null : v;
  };

  // ---------------- map ----------------
  const mapEl = document.getElementById("zip-map");
  function zipTip(z) {
    if (!z) return "";
    const key = metricSel.value;
    const v = valueOf(z, key);
    return tipRows(`ZIP ${z.zip} · ${z.borough}`, [
      [METRICS[key].label, v == null ? (z.income_note === "topcoded" && key === "median_household_income" ? "$250,000+" : "n/a") : METRICS[key].fmt(v)],
      key !== "rent_burden_rate" && ["Rent burden rate", fmt.pct(valueOf(z, "rent_burden_rate"))],
      ...zipUnc(z),
      ["Renter households (est.)", fmt.int(z.renter_households)],
      key === "pressure_index_alt" && z.alt_exclusion && ["Alternative ranking", `excluded (${z.alt_exclusion})`],
    ], z.renter_households <= 0 ? "No renter households with computed burden"
      : joinNotes(uncertaintyWarning(z.reliability), z.zip === "10463" ? MARBLE_HILL : null, "Click to select"));
  }
  // Excluded Manhattan ZCTAs (10162, 10279): drawn for documentation only, outside the HW4 study population.
  function excludedTip(e) {
    return tipRows(`ZIP ${e.zip} · Manhattan — excluded`, [
      ["Rent burden rate (est.)", `${fmt.pct(e.rent_burden_rate)} ± ${fmt.dec(e.rent_burden_rate_moe)}`],
      ["90% margin of error (MOE)", `± ${fmt.dec(e.rent_burden_rate_moe)} pts`],
      ["Reliability", e.reliability === "unusable" ? "Unusable (zero-count estimate)" : `${relText(e.reliability)} (CV ${fmt.dec(e.rent_burden_rate_cv)}%)`],
      ["Renter households (est.)", fmt.int(e.renter_households)],
    ], `⚠ ${e.note}<br>Not part of the HW4 study population, totals or rankings (see the inclusion comparison in the Borough section).`);
  }

  function drawMap() {
    const w = mapEl.clientWidth;
    if (!w) return;
    const h = Math.min(w, 680);
    const key = metricSel.value;
    const boro = boroSel.value;
    const M = METRICS[key];
    const vals = zipData.map((z) => valueOf(z, key)).filter((v) => v != null);
    const color = d3.scaleQuantile().domain(vals).range(seq());
    const focusFC = boro === "all" ? zcta : { type: "FeatureCollection", features: zcta.features.filter((f) => f.properties.borough === boro) };
    const proj = d3.geoMercator().fitExtent([[8, 8], [w - 8, h - 8]], focusFC);
    const path = d3.geoPath(proj);

    d3.select(mapEl).selectAll("*").remove();
    const svg = d3.select(mapEl).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
      .attr("aria-label", `Map of ${M.label} by ZIP code${boro !== "all" ? ` in ${boro}` : ""}`);
    const defs = svg.append("defs");
    defs.append("pattern").attr("id", "hatch").attr("patternUnits", "userSpaceOnUse").attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)")
      .call((p) => { p.append("rect").attr("width", 5).attr("height", 5).attr("fill", COLORS.hatchA); p.append("line").attr("y2", 5).attr("stroke", COLORS.hatchB).attr("stroke-width", 2); });
    // cross-hatch = excluded from the HW4 study population (distinct from the single-hatch "no data")
    defs.append("pattern").attr("id", "xhatch").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6)
      .call((p) => { p.append("rect").attr("width", 6).attr("height", 6).attr("fill", COLORS.hatchA);
        p.append("path").attr("d", "M0,0L6,6M6,0L0,6").attr("stroke", COLORS.mid).attr("stroke-width", 1.2); });
    defs.append("clipPath").attr("id", "map-clip").append("rect").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("clip-path", "url(#map-clip)");
    const { selected } = store.get();
    const studyFeatures = zcta.features.filter((f) => !f.properties.excluded);
    const paths = g.selectAll("path.zcta").data(studyFeatures).join("path")
      .attr("class", (f) => `zcta${boro !== "all" && f.properties.borough !== boro ? " dim" : ""}${selected.includes(f.properties.zip) ? " selected" : ""}`)
      .attr("d", path)
      .attr("fill", (f) => { const v = valueOf(zipIndex.get(f.properties.zip), key); return v == null ? "url(#hatch)" : color(v); })
      .attr("aria-label", (f) => `ZIP ${f.properties.zip}`);
    bindTip(paths, (f) => zipTip(zipIndex.get(f.properties.zip)));
    paths.on("click keydown", (e, f) => { if (e.type === "click" || e.key === "Enter") store.toggle(f.properties.zip); });
    // excluded ZCTAs: tooltip only, not selectable (they are not in the study population)
    const exPaths = g.selectAll("path.zcta-excluded").data(zcta.features.filter((f) => f.properties.excluded)).join("path")
      .attr("class", `zcta zcta-excluded${boro !== "all" && boro !== "Manhattan" ? " dim" : ""}`)
      .attr("d", path).attr("fill", "url(#xhatch)")
      .attr("aria-label", (f) => `ZIP ${f.properties.zip}, excluded from the study population`);
    bindTip(exPaths, (f) => excludedTip(excludedIndex.get(f.properties.zip)));
    g.selectAll("path.zcta.selected").raise();
    g.selectAll("path.boro-outline").data(outlines.features).join("path").attr("class", "boro-outline").attr("d", path);

    // legend
    const q = color.quantiles();
    const tickFmt = M.kind === "usd" ? (v) => `$${d3.format(".0f")(v / 1000)}K` : M.kind === "count" ? d3.format(",.0f") : d3.format(".0f");
    document.getElementById("map-legend").innerHTML = `
      <div><strong>${M.label}</strong> — ${M.unit}; ${seq().length} quantile classes across all NYC ZCTAs</div>
      <div class="ramp">${seq().map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ticks"><span>${tickFmt(d3.min(vals))}</span>${q.filter((_, i) => i % 2 === 1).map((t) => `<span>${tickFmt(t)}</span>`).join("")}<span>${tickFmt(d3.max(vals))}</span></div>
      <span class="na"><i></i> No data (no computed renter households${key === "median_household_income" ? ", or income top-coded/suppressed" : key === "pressure_index_alt" ? ", or excluded from the alternative ranking: CV > 30% or < 1,000 renter households" : ""})</span>
      <span class="na"><i class="x"></i> Excluded Manhattan ZCTAs 10162 and 10279 (outside the HW4 study population; hover for details)</span>`;
    document.getElementById("map-source").textContent = `${M.src} Boundaries: Census 2020 ZCTA cartographic file (simplified).`;
  }

  // ---------------- detail panel ----------------
  const detailEl = document.getElementById("zip-detail");
  function drawDetail() {
    const { focus, selected } = store.get();
    const z = focus && zipIndex.get(focus);
    if (!z) {
      detailEl.innerHTML = `<h3 style="font-size:1.2rem">Select a ZIP code</h3>
        <p class="empty">Click an area on the map, search above, or pick a row in the table. Selected ZIPs (up to five) appear in the comparison chart below.</p>
        <p class="empty">Areas with hatching have no renter households for which burden is computed (e.g. airports, parks, commercial districts).</p>`;
      return;
    }
    const valid = z.renter_households > 0;
    const badges = [
      z.top10_pressure && `<span class="badge">HW4 top-10: pressure index</span>`,
      z.top10_activity && `<span class="badge">HW4 top-10: HPD activity</span>`,
      z.reliability === "low" && `<span class="badge warn">Low reliability (CV ${z.rent_burden_rate_cv}%)</span>`,
      z.reliability === "moderate" && `<span class="badge warn">Moderate reliability (CV ${z.rent_burden_rate_cv}%)</span>`,
      !valid && `<span class="badge warn">No computed renter households</span>`,
    ].filter(Boolean).join("");
    const income = z.income_note === "topcoded" ? "$250,000+ <small>(top-coded)</small>" : z.income_note === "suppressed" ? "<small>suppressed</small>" : fmt.usd(z.median_household_income);
    detailEl.innerHTML = `
      <h3>${z.zip}</h3><div class="boro">${z.borough}</div>
      <div>${badges}</div>
      ${valid && uncertaintyWarning(z.reliability) ? `<p class="uncertainty-warning" role="note">${uncertaintyWarning(z.reliability)}</p>` : ""}
      ${z.zip === "10463" ? `<p class="data-note" role="note"><strong>Marble Hill.</strong> ${MARBLE_HILL}</p>` : ""}
      <dl>
        <dt class="group">Rent burden · ACS B25070 (survey estimates)</dt>
        <dt>Rent burden rate</dt><dd>${valid ? `${fmt.pct(z.rent_burden_rate)} <small>±${fmt.dec(z.rent_burden_rate_moe)}</small>` : "n/a"}</dd>
        <dt>…90% margin of error</dt><dd>${valid ? `± ${fmt.dec(z.rent_burden_rate_moe)} pts` : "n/a"}</dd>
        <dt>…reliability</dt><dd>${valid ? `${relText(z.reliability)} <small>(CV ${fmt.dec(z.rent_burden_rate_cv)}%)</small>` : "n/a"}</dd>
        <dt>Severe (≥50%)</dt><dd>${valid ? `${fmt.pct(z.severe_rent_burden_rate)} <small>±${fmt.dec(z.severe_rent_burden_rate_moe)}</small>` : "n/a"}</dd>
        <dt>Rent-burdened households</dt><dd>${fmt.int(z.rent_burdened_households)}</dd>
        <dt>Renter households (computed)</dt><dd>${fmt.int(z.renter_households)}</dd>
        <dt>Burden not computed</dt><dd>${fmt.int(z.not_computed)}</dd>
        <dt class="group">Income · ACS B19013 (survey estimate)</dt>
        <dt>Median household income</dt><dd>${income}</dd>
        <dt class="group">Affordable housing · HPD (administrative counts)</dt>
        <dt>Counted affordable units</dt><dd>${fmt.int(z.affordable_units)}</dd>
        <dt>…rental / homeownership</dt><dd>${fmt.int(z.affordable_rental_units)} / ${fmt.int(z.affordable_homeownership_units)}</dd>
        <dt>…new construction / preservation</dt><dd>${fmt.int(z.new_construction_units)} / ${fmt.int(z.preservation_units)}</dd>
        <dt>Units per 1,000 renter households</dt><dd>${valid ? fmt.dec(z.affordable_units_per_1000) : "n/a"}</dd>
        <dt class="group">Custom HW4 indices (0–100, relative; not official)</dt>
        <dt>Burden + low HPD activity</dt><dd>${fmt.dec(z.pressure_index_hpd)}${z.idx_hpd_burden_rank ? ` <small>ranks ${z.idx_hpd_burden_rank} / ${z.idx_hpd_activity_rank} of ${z.idx_hpd_n}</small>` : ""}</dd>
        <dt>Burden + low income</dt><dd>${fmt.dec(z.pressure_index_income)}${z.idx_inc_burden_rank ? ` <small>ranks ${z.idx_inc_burden_rank} / ${z.idx_inc_income_rank} of ${z.idx_inc_n}</small>` : ""}</dd>
        <dt class="group">Exploratory alternative (not HW4)</dt>
        <dt>Reliable ZIPs, rental units only</dt><dd>${z.pressure_index_alt != null ? `${fmt.dec(z.pressure_index_alt)} <small>ranks ${z.idx_alt_burden_rank} / ${z.idx_alt_activity_rank} of ${z.idx_alt_n}</small>` : `<small>excluded${z.alt_exclusion ? `: ${z.alt_exclusion}` : ""}</small>`}</dd>
      </dl>
      <p class="source">± values are approximate 90% margins of error (ACS method). Survey estimates have sampling error; HPD counts do not.</p>
      <p style="margin-top:14px"><button class="btn-link" id="detail-toggle">${selected.includes(z.zip) ? "Remove from comparison" : "Add to comparison"}</button></p>`;
    detailEl.querySelector("#detail-toggle").addEventListener("click", () => store.toggle(z.zip));
  }

  // ---------------- comparison ----------------
  const cmpEl = document.getElementById("compare-chart");
  const nycB = ctx.boroughSummary["New York City"];
  function drawCompare(width) {
    const { selected } = store.get();
    const nycCv = cvOf(nycB.rent_burden_rate, nycB.rent_burden_rate_moe);
    const base = [{ label: "New York City", rate: nycB.rent_burden_rate, severe: nycB.severe_rent_burden_rate, moe: nycB.rent_burden_rate_moe, smoe: nycB.severe_rent_burden_rate_moe, sub: "all ZCTAs",
      cv: nycCv, cls: reliabilityClass(nycCv) }];
    const zs = selected.map((zp) => zipIndex.get(zp)).map((z) => ({
      label: `${z.zip} · ${z.borough}`, rate: z.rent_burden_rate ?? 0, severe: z.severe_rent_burden_rate ?? 0,
      moe: z.rent_burden_rate_moe, smoe: z.severe_rent_burden_rate_moe, sub: z.reliability === "low" ? "low reliability" : null,
      cv: z.rent_burden_rate_cv, cls: z.renter_households > 0 ? z.reliability : null,
    }));
    if (!zs.length) {
      cmpEl.innerHTML = `<p class="empty-state">No ZIPs selected yet — click the map, search for a ZIP, or click a table row.</p>`;
      return;
    }
    const series = [{ key: "severe", color: COLORS.emph }, { key: "moderate", color: COLORS.soft }];
    stackedH(cmpEl, {
      width, xMax: 100, fmt: { axis: (v) => `${v}%` }, xTitle: "% of renter households",
      ariaLabel: "Comparison of rent burden for selected ZIP codes",
      series,
      rows: [...base, ...zs].map((r) => ({
        label: r.label,
        segs: [{ key: "severe", value: r.severe }, { key: "moderate", value: r.rate - r.severe }],
        tip: () => tipRows(r.label, [
          ["Rent burden (≥30%)", `${fmt.pct(r.rate)} ± ${fmt.dec(r.moe)}`],
          ["Severe (≥50%)", `${fmt.pct(r.severe)} ± ${fmt.dec(r.smoe)}`],
          ["30–49.9%", fmt.pct(r.rate - r.severe)],
          r.cls && ["Reliability (burden rate)", `${relText(r.cls)} (CV ${fmt.dec(r.cv)}%)`],
        ], joinNotes(r.cls === "low" ? uncertaintyWarning(r.cls) : r.sub, "± = 90% MOE (survey estimate)")),
      })),
      totalLabel: (row, t) => fmt.pct(t),
    });
    cmpEl.insertAdjacentHTML("afterbegin", `<div class="legend"><span class="key"><span class="sw" style="background:${COLORS.emph}"></span>Severe: ≥50% of income</span><span class="key"><span class="sw" style="background:${COLORS.soft}"></span>Moderate: 30–49.9%</span></div>`);
  }
  document.getElementById("compare-clear").addEventListener("click", () => store.set({ selected: [], focus: null }));

  // ---------------- income scatter ----------------
  const scEl = document.getElementById("income-scatter");
  const assoc = Object.fromEntries(stats.income_vs_burden.map((a) => [a.group, a]));
  function drawScatter(width) {
    const boro = boroSel.value;
    const grp = boro === "all" ? "New York City" : boro;
    const a = assoc[grp];
    const { selected } = store.get();
    const pts = zipData.filter((z) => z.renter_households > 0 && z.median_household_income != null);
    const inGroup = pts.filter((z) => boro === "all" || z.borough === boro);
    document.getElementById("scatter-sub").innerHTML =
      `Each dot is a ZCTA. ${grp}: Pearson <em>r</em> = ${a.r.toFixed(2)}, n = ${a.n}; slope ≈ ${a.slope_per_10k.toFixed(2)} pts per $10,000.
       ${pts.length} ZCTAs plotted; 3 top-coded ZIPs ($250,000+) excluded, as in HW4.`;
    scatter(scEl, {
      width, xTitle: "Median household income (2024 $)", yTitle: "Rent burden rate (%)",
      xFmt: (v) => `$${d3.format(".0f")(v / 1000)}K`, yFmt: (v) => `${v}%`,
      ariaLabel: "Scatter plot of median household income versus rent burden rate by ZIP",
      trend: { intercept: a.intercept, slope: a.slope, xMin: d3.min(inGroup, (z) => z.median_household_income), xMax: d3.max(inGroup, (z) => z.median_household_income) },
      data: pts.map((z) => ({
        x: z.median_household_income, y: z.rent_burden_rate, id: z.zip,
        active: boro === "all" || z.borough === boro, selected: selected.includes(z.zip),
        tip: tipRows(`ZIP ${z.zip} · ${z.borough}`, [["Median income", fmt.usd(z.median_household_income)], ["Rent burden rate", fmt.pct(z.rent_burden_rate)], ...zipUnc(z)],
          joinNotes(uncertaintyWarning(z.reliability), "Click to select")),
      })),
      onClick: (d) => store.toggle(d.id),
    });
  }

  // ---------------- table ----------------
  const tableEl = document.getElementById("zip-table");
  const cols = [
    { k: "zip", h: "ZIP", f: (z) => z.zip, c: "l" },
    { k: "borough", h: "Borough", f: (z) => z.borough, c: "l" },
    { k: "renter_households", h: "Renter hh (est.)", f: (z) => fmt.int(z.renter_households) },
    { k: "rent_burden_rate", h: "Burden %", f: (z) => (z.renter_households > 0 ? `${fmt.dec(z.rent_burden_rate)}${z.reliability === "low" ? "*" : ""}` : "—") },
    { k: "rent_burden_rate_moe", h: "± 90% MOE", f: (z) => (z.renter_households > 0 ? fmt.dec(z.rent_burden_rate_moe) : "—") },
    { k: "rent_burden_rate_cv", h: "Reliability", c: "l", f: (z) => (z.renter_households > 0 ? `${z.reliability === "low" ? "⚠ " : ""}${relText(z.reliability)}` : "—") },
    { k: "severe_rent_burden_rate", h: "Severe %", f: (z) => (z.renter_households > 0 ? fmt.dec(z.severe_rent_burden_rate) : "—") },
    { k: "affordable_units", h: "HPD units (count)", f: (z) => fmt.int(z.affordable_units) },
    { k: "affordable_units_per_1000", h: "per 1,000", f: (z) => fmt.dec(z.affordable_units_per_1000) },
    { k: "median_household_income", h: "Median income", f: (z) => (z.income_note === "topcoded" ? "$250,000+" : fmt.usd(z.median_household_income)) },
    { k: "pressure_index_hpd", h: "Pressure (HPD)", f: (z) => fmt.dec(z.pressure_index_hpd) },
    { k: "pressure_index_income", h: "Pressure (income)", f: (z) => fmt.dec(z.pressure_index_income) },
  ];
  let sortKey = "rent_burden_rate", sortDir = -1;
  function drawTable() {
    const boro = boroSel.value;
    const { selected } = store.get();
    const rows = zipData.filter((z) => boro === "all" || z.borough === boro).sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sortDir;
    });
    tableEl.innerHTML =
      `<thead><tr>${cols.map((c) => `<th scope="col" class="sortable ${c.c || ""}" data-k="${c.k}" tabindex="0" ${c.k === sortKey ? `aria-sort="${sortDir > 0 ? "ascending" : "descending"}"` : ""}>${c.h}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((z) => `<tr class="clickable${selected.includes(z.zip) ? " is-selected" : ""}" data-zip="${z.zip}" tabindex="0">${cols.map((c) => `<td class="${c.c || ""}">${c.f(z)}</td>`).join("")}</tr>`).join("")}</tbody>` +
      `<caption class="source" style="caption-side:bottom;text-align:left">Reliability of the rent burden rate from its coefficient of variation (CV): High ≤ 15%, Moderate 15–30%, Low &gt; 30% (⚠ and * mark low reliability: use with caution). Sources: ACS 2024 5-Year B25070, B19013; NYC HPD.</caption>`;
  }
  tableEl.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-k]");
    if (th) { const k = th.dataset.k; sortDir = k === sortKey ? -sortDir : (k === "zip" || k === "borough" ? 1 : -1); sortKey = k; drawTable(); return; }
    const tr = e.target.closest("tr[data-zip]");
    if (tr) store.toggle(tr.dataset.zip);
  });
  tableEl.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.click(); });

  // ---------------- wiring ----------------
  search.addEventListener("change", () => {
    const zp = search.value.trim().slice(0, 5);
    if (zipIndex.has(zp)) { store.select(zp); search.value = ""; }
    else if (zp) search.setCustomValidity("Not an analysed NYC ZIP code"), search.reportValidity();
  });
  search.addEventListener("input", () => {
    search.setCustomValidity("");
    const zp = search.value.trim();
    if (/^\d{5}$/.test(zp) && zipIndex.has(zp)) { store.select(zp); search.value = ""; }
  });
  metricSel.addEventListener("change", drawMap);
  boroSel.addEventListener("change", () => { drawMap(); drawScatter(scEl.clientWidth); drawTable(); });

  onResize(mapEl, drawMap);
  onResize(cmpEl, drawCompare);
  onResize(scEl, drawScatter);
  drawDetail(); drawTable();
  store.subscribe(() => { drawMap(); drawDetail(); drawCompare(cmpEl.clientWidth); drawScatter(scEl.clientWidth); drawTable(); });
}
