// Section B — Borough comparison: metric bar chart, ZIP spread strip plot, summary table.
import { fmt, METRICS, onResize, tipRows, uncertaintyRows, uncertaintyWarning, joinNotes, reliabilityClass, cvOf, relText } from "../util.js";
import { hBars, strip } from "../charts.js";


export function init({ boroughSummary, zipData, BOROUGHS, store, excluded }) {
  const metricSel = document.getElementById("boro-metric");
  const sortSel = document.getElementById("boro-sort");
  const chartEl = document.getElementById("boro-chart");
  const nyc = boroughSummary["New York City"];
  // Borough reliability uses the same CV rule as ZIPs, applied to the pooled rate and its MOE.
  const boroCv = (b) => cvOf(b.rent_burden_rate, b.rent_burden_rate_moe);
  const boroCls = (b) => reliabilityClass(boroCv(b));

  const tipFor = (b) => tipRows(b.borough, [
    ["Rent burden rate", `${fmt.pct(b.rent_burden_rate)} ± ${b.rent_burden_rate_moe.toFixed(1)}`],
    ...uncertaintyRows({ moe: b.rent_burden_rate_moe, cv: boroCv(b) }),
    ["Severe rent burden", `${fmt.pct(b.severe_rent_burden_rate)} ± ${b.severe_rent_burden_rate_moe.toFixed(1)}`],
    ["Rent-burdened households", fmt.int(b.rent_burdened_households)],
    ["Renter households (est., computed)", fmt.int(b.renter_households)],
    ["HPD units / 1,000 renters", fmt.dec(b.hpd_units_per_1000_renters)],
    ["ZCTAs", `${b.zip_count_valid}`],
  ], joinNotes(uncertaintyWarning(boroCls(b)), "± = approximate 90% margin of error"));

  function draw(width) {
    const key = metricSel.value;
    const M = METRICS[key];
    let data = BOROUGHS.map((name) => {
      const b = boroughSummary[name];
      return { label: name, value: b[key], moe: M.moe ? b[M.moe] : null, tip: tipFor(b) };
    });
    data = sortSel.value === "name" ? data.sort((a, b) => a.label.localeCompare(b.label)) : data.sort((a, b) => b.value - a.value);
    const showRef = M.kind === "pct" || key === "hpd_units_per_1000_renters";
    document.getElementById("boro-chart-title").textContent = M.label;
    document.getElementById("boro-chart-source").textContent =
      `${M.src}${showRef ? ` Dashed line: New York City (${M.fmt(nyc[key])}).` : ""}`;
    hBars(chartEl, {
      data, width, fmt: M.fmt, xTitle: M.unit, ariaLabel: `${M.label} by borough`,
      ref: showRef ? { value: nyc[key] } : null,
    });
  }
  const redraw = () => draw(chartEl.clientWidth);
  metricSel.addEventListener("change", redraw);
  sortSel.addEventListener("change", redraw);
  onResize(chartEl, draw);

  // Strip plot of ZIP rates
  const stripEl = document.getElementById("boro-strip");
  const valid = zipData.filter((z) => z.renter_households > 0);
  const order = [...BOROUGHS].sort((a, b) => boroughSummary[b].rent_burden_rate - boroughSummary[a].rent_burden_rate);
  onResize(stripEl, (w) => strip(stripEl, {
    width: w, groups: order, xTitle: "Rent burden rate (%)",
    ariaLabel: "Rent burden rate of each ZIP code, grouped by borough",
    data: valid.map((z) => ({
      group: z.borough, value: z.rent_burden_rate, unreliable: z.reliability === "low", zip: z.zip,
      tip: tipRows(`ZIP ${z.zip} · ${z.borough}`, [
        ["Rent burden rate", `${fmt.pct(z.rent_burden_rate)} ± ${fmt.dec(z.rent_burden_rate_moe)}`],
        ...uncertaintyRows({ moe: z.rent_burden_rate_moe, cv: z.rent_burden_rate_cv, cls: z.reliability }),
        ["Severe", fmt.pct(z.severe_rent_burden_rate)],
        ["Renter households", fmt.int(z.renter_households)],
      ], joinNotes(uncertaintyWarning(z.reliability), "± = 90% MOE (survey estimate)", "Click to open in the ZIP explorer")),
    })),
    marks: order.map((g) => ({ group: g, value: boroughSummary[g].rent_burden_rate })),
    onClick: (d) => { store.select(d.zip); document.getElementById("zips").scrollIntoView(); },
  }));

  // Summary table
  const cols = [
    ["Borough", (b) => b.borough, "l"],
    ["ZCTAs", (b) => b.zip_count_valid],
    ["Renter households (est.)", (b) => fmt.int(b.renter_households)],
    ["Rent-burdened", (b) => fmt.int(b.rent_burdened_households)],
    ["Rate (± 90% MOE)", (b) => `${fmt.pct(b.rent_burden_rate)} <small>±${b.rent_burden_rate_moe.toFixed(1)}</small>`],
    ["Reliability", (b) => `${boroCls(b) === "low" ? "⚠ " : ""}${relText(boroCls(b))} <small>(CV ${fmt.dec(boroCv(b))}%)</small>`],
    ["Severe (± 90% MOE)", (b) => `${fmt.pct(b.severe_rent_burden_rate)} <small>±${b.severe_rent_burden_rate_moe.toFixed(1)}</small>`],
    ["HPD units (count)", (b) => fmt.int(b.hpd_units_all_records)],
    ["HPD units / 1,000 renters", (b) => fmt.dec(b.hpd_units_per_1000_renters)],
  ];
  const rows = [...BOROUGHS, "New York City"].map((n) => boroughSummary[n]);
  document.getElementById("boro-table").innerHTML =
    `<caption class="source" style="caption-side:bottom;text-align:left">Renter households = households for which gross rent as a share of income is computed. HPD units include records without a postcode. Sources: ACS 2024 5-Year B25070; NYC HPD.</caption>` +
    `<thead><tr>${cols.map(([h, , c]) => `<th class="${c || ""}" scope="col">${h}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((b) => `<tr class="${b.borough === "New York City" ? "total" : ""}">${cols.map(([, f, c]) => `<td class="${c || ""}">${f(b)}</td>`).join("")}</tr>`).join("")}</tbody>`;

  // Excluded Manhattan ZCTAs — optional geographic inclusion comparison (documentation only;
  // these ZCTAs stay outside the HW4 study population, totals, maps and rankings).
  const ex = excluded;
  const relLabel = (e) => (e.reliability === "unusable" ? "⚠ Unusable — zero-count estimate (CV not defined)" : `⚠ ${relText(e.reliability)} (CV ${fmt.dec(e.rent_burden_rate_cv)}%)`);
  const cmp = (area, version) => ex.comparison.find((c) => c.area === area && c.version === version);
  const cmpRow = (area) => {
    const a = cmp(area, "HW4 study population"), b = ex.comparison.find((c) => c.area === area && c.version !== "HW4 study population");
    return `<tr><td>${area}</td><td>${a.zip_count_valid} → ${b.zip_count_valid}</td><td>${fmt.int(a.renter_households)} → ${fmt.int(b.renter_households)}</td>
      <td>${a.rent_burden_rate.toFixed(3)}%</td><td>${b.rent_burden_rate.toFixed(3)}%</td><td>${(b.rent_burden_rate - a.rent_burden_rate >= 0 ? "+" : "")}${(b.rent_burden_rate - a.rent_burden_rate).toFixed(3)} pts</td></tr>`;
  };
  document.getElementById("excluded-content").innerHTML = `
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th scope="col">ZCTA</th><th scope="col">Renter hh (est.)</th><th scope="col">Rent burden (est.)</th><th scope="col">± 90% MOE</th><th scope="col" class="l">Reliability</th></tr></thead>
      <tbody>${ex.zctas.map((e) => `<tr><td>${e.zip} · Manhattan</td><td>${fmt.int(e.renter_households)}</td><td>${fmt.pct(e.rent_burden_rate)}</td>
        <td>± ${fmt.dec(e.rent_burden_rate_moe)} pts</td><td class="l">${relLabel(e)}</td></tr>`).join("")}</tbody>
    </table></div>
    <ul class="card-sub" style="margin:10px 0 0;padding-left:1.2em">
      ${ex.zctas.map((e) => `<li><strong>${e.zip}:</strong> ${e.note}</li>`).join("")}
    </ul>
    <h4 class="card-title" style="font-size:.95rem;margin-top:14px">If both were included (HW4 formulas unchanged)</h4>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th scope="col">Area</th><th scope="col">ZCTAs</th><th scope="col">Renter hh (est.)</th><th scope="col">HW4 rate</th><th scope="col">With both</th><th scope="col">Difference</th></tr></thead>
      <tbody>${cmpRow("Manhattan")}${cmpRow("New York City")}</tbody>
    </table></div>
    <p class="source">The borough order is ${ex.borough_order_unchanged ? "unchanged" : "changed"}; rounded to one decimal, every borough rate is identical to HW4.
      Both ZCTAs border only Manhattan ZCTAs (10162: 10021, 10075; 10279: 10007). Source: ACS 2024 5-Year, B25070.</p>
    <p class="data-note"><strong>ZIP 10463 and Marble Hill.</strong> Marble Hill is legally part of Manhattan (New York County) but lies on the Bronx mainland, inside ZIP 10463.
      HW4 assigns the whole ZIP to the Bronx; ACS data are not available for Marble Hill separately at ZCTA level, so its households are counted in the Bronx figures.</p>`;
}
