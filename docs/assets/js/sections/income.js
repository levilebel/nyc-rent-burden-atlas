// Section — Income. The scatter plot is drawn by zips.js (shared ZIP selection);
// this module renders the borough-level association table from statistics.json.
import { fmt } from "../util.js";

export function init({ stats, BOROUGHS }) {
  const by = new Map(stats.income_vs_burden.map((a) => [a.group, a]));
  const order = ["New York City", ...BOROUGHS].filter((g) => by.has(g));
  document.getElementById("income-assoc").innerHTML =
    `<thead><tr><th scope="col">Area</th><th scope="col">ZIP codes (n)</th><th scope="col">Pearson r</th><th scope="col">Slope: pts per $10,000</th></tr></thead>` +
    `<tbody>${order.map((g) => { const a = by.get(g); return `<tr class="${g === "New York City" ? "total" : ""}">
      <td>${g}</td><td>${a.n}</td><td>${a.r.toFixed(2)}</td><td>${a.slope_per_10k >= 0 ? "+" : ""}${fmt.dec(a.slope_per_10k, 2)}</td></tr>`; }).join("")}</tbody>`;
}
