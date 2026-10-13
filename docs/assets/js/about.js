// About page: shared site chrome plus three headline figures read from the processed data
// (never typed into the page, so they stay in sync with the pipeline).
import { initNav, initTheme } from "./site.js";

initNav();
initTheme();

const int = new Intl.NumberFormat("en-US");
(async () => {
  try {
    const [boroughs, meta] = await Promise.all([
      fetch("data/borough_summary.json").then((r) => r.json()),
      fetch("data/metadata.json").then((r) => r.json()),
    ]);
    const nyc = boroughs.find((b) => b.borough === "New York City");
    const facts = [
      { label: "Renter households spending ≥30% of income on rent", value: `${nyc.rent_burden_rate.toFixed(1)}%`, note: "New York City, ACS 2020–2024 estimate" },
      { label: "ZIP code areas analysed", value: int.format(meta.counts.nyc_zctas_valid), note: "across all five boroughs" },
      { label: "HPD counted affordable units", value: int.format(nyc.hpd_units_all_records), note: `projects started ${meta.counts.hpd_project_start_min.slice(0, 4)}–${meta.counts.hpd_project_start_max.slice(0, 4)}` },
    ];
    document.getElementById("about-facts").innerHTML = facts.map((k) =>
      `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="note">${k.note}</div></div>`).join("");
    document.getElementById("about-facts-source").textContent = `Figures from the processed project data (build ${meta.build.generated}).`;
  } catch (e) {
    document.getElementById("about-facts").innerHTML = "";
  }
})();
