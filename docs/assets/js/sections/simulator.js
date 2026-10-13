// Section — Policy simulator (what-if). Illustrative, NOT a causal forecast.
// Recomputes the HW4 pressure index in the browser (assets/js/sim.js) after adding a hypothetical
// number of affordable units per 1,000 renter households to a chosen group of ZIPs.
/* global d3 */
import { fmt, COLORS, seq, onResize, onTheme, tipRows, relText } from "../util.js";
import { choropleth, rewindFC } from "../charts.js";
import { indexRows, simulate, checkBaseline } from "../sim.js";

const PRESETS = [10, 25, 50];

export function init({ zipData, zcta, outlines, stats, boroughSummary, BOROUGHS }) {
  rewindFC(zcta); rewindFC(outlines);
  const rows = indexRows(zipData);
  const byZip = new Map(rows.map((r) => [r.zip, r]));
  const features = zcta.features.filter((f) => !f.properties.excluded); // HW4 study population only
  const nycUnits = boroughSummary["New York City"].hpd_units_all_records;
  const check = checkBaseline(rows, stats.top10_pressure);

  const deltaBtns = [...document.querySelectorAll("#sim-delta [data-delta]")];
  const custom = document.getElementById("sim-custom");
  const targetSel = document.getElementById("sim-target");
  targetSel.insertAdjacentHTML("beforeend",
    BOROUGHS.map((b) => `<option value="borough:${b}">All ZIPs in ${b}</option>`).join("") +
    `<option value="all">All ZIPs citywide (uniform increase)</option>`);
  const state = { delta: 25, target: "top10" };
  let result = null;

  if (!check.ok) {
    document.getElementById("sim-status").innerHTML = `<p class="load-error card" role="alert"><strong>Check failed:</strong> the browser recomputation does not match the published HW4 index (max difference ${check.maxDiff.toFixed(2)}). Results are shown for transparency but should not be used.</p>`;
  }

  // ---------- colour scales ----------
  // Current and projected maps share one fixed 0–100 scale so they are directly comparable.
  const indexColor = () => d3.scaleQuantize().domain([0, 100]).range(seq());
  const changeScale = (res) => {
    const m = Math.max(1, d3.max(res.perZip, (z) => Math.abs(z.change)));
    const t = [-2 * m / 3, -m / 3, -0.05, 0.05, m / 3, 2 * m / 3];
    return { m, t, scale: d3.scaleThreshold().domain(t).range([...COLORS.divNeg, COLORS.divZero, ...COLORS.divPos]) };
  };

  // ---------- tooltips ----------
  const uncertainty = (r) => (r.reliability === "low" || r.renters < 1000)
    ? `⚠ ${r.reliability === "low" ? "Low reliability" : "Small sample"}: ${fmt.int(r.renters)} renter households (est.)` : null;
  const tipFor = (mode) => (zp) => {
    const z = result.perZip.find((d) => d.zip === zp);
    if (!z) return tipRows(`ZIP ${zp}`, [["Pressure index", "n/a"]], "No renter households with computed burden — not ranked");
    const items = [
      ["Pressure index now", fmt.dec(z.before)],
      mode !== "before" && ["Pressure index (scenario)", fmt.dec(z.after)],
      ["Pressure rank (1 = highest)", mode === "before" ? `${z.rankBefore} of ${rows179}` : `${z.rankBefore} → ${z.rankAfter} of ${rows179}`],
      mode !== "before" && ["Change", `${z.change >= 0 ? "+" : ""}${fmt.dec(z.change)}`],
      ["Rent burden rate (est., unchanged)", fmt.pct(z.rate)],
      ["HPD units / 1,000 renters", z.targeted && mode !== "before" ? `${fmt.dec(z.per1000)} → ${fmt.dec(z.per1000After)}` : fmt.dec(z.per1000)],
      ["Burden rank / low-activity rank", mode === "before" ? `${z.beforeRanks[0]} / ${z.beforeRanks[1]} of ${rows179}` : `${z.afterRanks[0]} / ${z.afterRanks[1]} of ${rows179}`],
    ];
    const note = z.targeted
      ? `Receives +${state.delta} units per 1,000 renter households in this scenario.`
      : mode === "before" ? null : "Not changed in this scenario — any change comes only from re-ranking (the index is relative).";
    return tipRows(`ZIP ${z.zip} · ${z.borough}`, items, [uncertainty(z), note].filter(Boolean).join("<br>") || null);
  };
  const rows179 = rows.length;

  // ---------- maps ----------
  const maps = [
    { el: document.getElementById("sim-map-before"), mode: "before" },
    { el: document.getElementById("sim-map-after"), mode: "after" },
    { el: document.getElementById("sim-map-change"), mode: "change" },
  ];
  function drawMap(m, w) {
    if (!result || !w) return;
    const ic = indexColor(), cs = changeScale(result);
    const val = new Map(result.perZip.map((z) => [z.zip, z]));
    choropleth(m.el, {
      features, outlines, width: w,
      ariaLabel: m.mode === "before" ? "Map of the current HW4 pressure index" : m.mode === "after" ? "Map of the pressure index under the scenario" : "Map of the change in pressure index under the scenario",
      fill: (zp) => { const z = val.get(zp); if (!z) return null; return m.mode === "change" ? cs.scale(z.change) : ic(m.mode === "before" ? z.before : z.after); },
      tip: tipFor(m.mode),
      ring: (zp) => val.get(zp)?.targeted,
    });
  }
  maps.forEach((m) => onResize(m.el, (w) => drawMap(m, w)));

  // ---------- legends (re-rendered on theme change) ----------
  function drawLegends() {
    if (!result) return;
    const cs = changeScale(result);
    document.getElementById("sim-legend-index").innerHTML = `
      <div><strong>Pressure index</strong> (HW4 formula, 0–100, relative) — same fixed scale on both maps</div>
      <div class="ramp">${seq().map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ticks"><span>0 lower</span><span>50</span><span>100 higher</span></div>`;
    const lab = (v) => `${v > 0 ? "+" : ""}${fmt.dec(v)}`;
    document.getElementById("sim-legend-change").innerHTML = `
      <div><strong>Change in index</strong> (scenario − current)</div>
      <div class="ramp">${[...COLORS.divNeg, COLORS.divZero, ...COLORS.divPos].map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ticks"><span>${lab(-cs.m)} falls</span><span>no change</span><span>${lab(cs.m)} rises</span></div>
      <span class="na"><i class="ring"></i> Outlined: ZIPs receiving the hypothetical increase</span>`;
  }
  onTheme(drawLegends);

  // ---------- summary, tables ----------
  const label = (zp) => `${zp} · ${byZip.get(zp).borough}`;
  const warn = (zp) => { const r = byZip.get(zp); return (r.reliability === "low" || r.renters < 1000) ? ` <span class="badge warn" title="${fmt.int(r.renters)} renter households (est.), ${relText(r.reliability)} reliability">⚠ ${fmt.int(r.renters)} hh</span>` : ""; };
  function drawSummary() {
    const s = result.summary;
    const targetText = targetSel.options[targetSel.selectedIndex].text;
    document.getElementById("sim-kpis").innerHTML = [
      { label: "ZIPs receiving the increase", value: `${s.targeted} of ${rows.length}`, note: targetText },
      { label: "Hypothetical additional units", value: `≈ ${fmt.int(Math.round(s.impliedUnits))}`, note: `+${state.delta} per 1,000 renter households (est.) in those ZIPs; for scale, HPD counted ${fmt.int(nycUnits)} units citywide for projects started 2014 – mid-2026` },
      { label: "Average pressure rank of those ZIPs", value: `${fmt.dec(s.meanRankBeforeTargeted)} → ${fmt.dec(s.meanRankAfterTargeted)}`, note: `1 = highest pressure, of ${rows.length}. Average index ${fmt.dec(s.meanBeforeTargeted)} → ${fmt.dec(s.meanAfterTargeted)} (0–100, rescaled)` },
      { label: "Other ZIPs whose index rises", value: fmt.int(s.othersRose), note: s.othersRose ? `by up to ${fmt.dec(s.maxOtherRise)} points, only from re-ranking` : "no re-ranking effect" },
    ].map((k) => `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="note">${k.note}</div></div>`).join("");

    const uniform = state.target === "all";
    document.getElementById("sim-narrative").innerHTML = uniform
      ? `<strong>No ZIP changes.</strong> Adding the same amount to every ZIP leaves all activity ranks unchanged, so a rank-based index cannot move. This shows that the index measures <em>relative</em> position, not absolute conditions.`
      : `Adding <strong>+${state.delta}</strong> HPD units per 1,000 renter households to <strong>${s.targeted}</strong> ZIPs (≈ ${fmt.int(Math.round(s.impliedUnits))} hypothetical units)
         moves their average pressure rank from ${fmt.dec(s.meanRankBeforeTargeted)} to ${fmt.dec(s.meanRankAfterTargeted)} (1 = highest pressure).
         Their average index changes less, from ${fmt.dec(s.meanBeforeTargeted)} to ${fmt.dec(s.meanAfterTargeted)}, because the 0–100 scale is re-stretched so that the most-pressured ZIP is always 100.
         ${s.othersRose ? `Because the index ranks ZIPs against each other, ${s.othersRose} ZIPs that receive nothing move up (by up to ${fmt.dec(s.maxOtherRise)} points) even though nothing about them changed.` : ""}
         ${s.leftTop10.length ? `${s.leftTop10.length} ZIP${s.leftTop10.length > 1 ? "s" : ""} leave${s.leftTop10.length > 1 ? "" : "s"} the top 10.` : "The top 10 stays the same."}
         Rent burden is held constant: the simulation does not predict whether burden would fall.`;

    const top = (list, other) => list.map((zp, i) => `<tr><td>${i + 1}</td><td class="l">${label(zp)}${warn(zp)}</td><td class="l">${other.includes(zp) ? "" : `<span class="badge">${list === result.topBefore ? "leaves" : "new"}</span>`}</td></tr>`).join("");
    document.getElementById("sim-top").innerHTML = `
      <div class="grid-2 tight">
        <div><h4 class="mini-title">Current top 10</h4><div class="table-scroll"><table class="data-table"><tbody>${top(result.topBefore, result.topAfter)}</tbody></table></div></div>
        <div><h4 class="mini-title">Scenario top 10</h4><div class="table-scroll"><table class="data-table"><tbody>${top(result.topAfter, result.topBefore)}</tbody></table></div></div>
      </div>`;

    const moved = [...result.perZip].sort((a, b) => a.change - b.change);
    const rowsOf = (list) => list.map((z) => `<tr><td>${label(z.zip)}${warn(z.zip)}</td><td>${fmt.dec(z.before)} <small>#${z.rankBefore}</small></td><td>${fmt.dec(z.after)} <small>#${z.rankAfter}</small></td><td>${z.change >= 0 ? "+" : ""}${fmt.dec(z.change)}</td><td class="l">${z.targeted ? `+${state.delta} units/1,000` : "re-ranked only"}</td></tr>`).join("");
    document.getElementById("sim-changes").innerHTML = uniform ? `<p class="empty-state">No index changes under a uniform increase.</p>` : `
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th scope="col">ZIP</th><th scope="col">Now (rank)</th><th scope="col">Scenario (rank)</th><th scope="col">Change</th><th scope="col" class="l">Why</th></tr></thead>
        <tbody>${rowsOf(moved.slice(0, 5))}<tr class="sep"><td colspan="5">Largest increases (not targeted)</td></tr>${rowsOf(moved.slice(-5).reverse())}</tbody>
      </table></div>`;
  }

  function run() {
    result = simulate(rows, state);
    maps.forEach((m) => drawMap(m, Math.round(m.el.clientWidth)));
    drawLegends();
    drawSummary();
  }

  // ---------- controls ----------
  const setDelta = (d, fromCustom) => {
    state.delta = d;
    deltaBtns.forEach((b) => b.setAttribute("aria-pressed", String(!fromCustom && Number(b.dataset.delta) === d)));
    if (!fromCustom) custom.value = "";
    run();
  };
  deltaBtns.forEach((b) => b.addEventListener("click", () => setDelta(Number(b.dataset.delta), false)));
  custom.addEventListener("input", () => {
    const v = Number(custom.value);
    if (custom.value !== "" && Number.isFinite(v) && v >= 0 && v <= 500) { custom.setCustomValidity(""); setDelta(v, true); }
    else if (custom.value !== "") { custom.setCustomValidity("Enter a number from 0 to 500"); custom.reportValidity(); }
  });
  targetSel.addEventListener("change", () => { state.target = targetSel.value; run(); });
  setDelta(PRESETS[1], false);
}
