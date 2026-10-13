// Entry point: load processed data, then initialise each section module.
// To add a section: create assets/js/sections/<name>.js exporting init(ctx),
// add its markup to index.html, and register it in SECTIONS below.
import { BOROUGHS, redrawAll, hideTip } from "./util.js";
import { initNav, initTheme } from "./site.js";
import * as overview from "./sections/overview.js";
import * as boroughs from "./sections/boroughs.js";
import * as zips from "./sections/zips.js";
import * as income from "./sections/income.js";
import * as housing from "./sections/housing.js";
import * as methods from "./sections/methods.js";
import * as research from "./sections/research.js";
import * as simulator from "./sections/simulator.js";
import * as policy from "./sections/policy.js";

const SECTIONS = [overview, boroughs, zips, income, housing, simulator, policy, methods, research];

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

// Minimal shared store for cross-section state (selected ZIPs).
function createStore(initial) {
  const subs = new Set();
  let state = initial;
  return {
    get: () => state,
    set(patch) { state = { ...state, ...patch }; subs.forEach((fn) => fn(state)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

async function main() {
  const [zipData, boroughSummary, hpdYear, stats, meta, registry, zcta, outlines, altRanking, excluded, policyContent] = await Promise.all([
    loadJSON("data/zip_data.json"),
    loadJSON("data/borough_summary.json"),
    loadJSON("data/hpd_by_year.json"),
    loadJSON("data/statistics.json"),
    loadJSON("data/metadata.json"),
    loadJSON("content/research.json"),
    loadJSON("data/zcta_nyc.geojson"),
    loadJSON("data/borough_outlines.geojson"),
    loadJSON("data/alternative_ranking.json"), // exploratory, website-only (not HW4)
    loadJSON("data/excluded_zctas.json"),      // 10162 / 10279, documentation only
    loadJSON("content/policy.json"),           // policy context (curated by the author; placeholders until verified)
  ]);

  const zipIndex = new Map(zipData.map((d) => [d.zip, d]));
  const store = createStore({ selected: [], focus: null });
  store.select = (zip) => {
    if (!zipIndex.has(zip)) return;
    const { selected } = store.get();
    const next = selected.includes(zip) ? selected : [...selected, zip].slice(-5);
    store.set({ selected: next, focus: zip });
  };
  store.toggle = (zip) => {
    const { selected, focus } = store.get();
    if (selected.includes(zip)) {
      const next = selected.filter((z) => z !== zip);
      store.set({ selected: next, focus: focus === zip ? next[next.length - 1] ?? null : focus });
    } else store.select(zip);
  };

  const ctx = {
    zipData, zipIndex, hpdYear, stats, meta, registry, zcta, outlines, altRanking, excluded, policyContent, store, BOROUGHS,
    boroughSummary: Object.fromEntries(boroughSummary.map((b) => [b.borough, b])),
  };
  for (const s of SECTIONS) {
    try { s.init(ctx); } catch (err) { console.error(err); }
  }
  document.getElementById("build-info").textContent =
    `Data build ${meta.build.generated} · ${meta.build.pipeline} · reproduces ${meta.build.reproduces.split("/").pop()}`;
}

initNav();
initTheme({ onChange: () => { hideTip(); redrawAll(); } }); // charts read the palette at draw time
main().catch((err) => {
  console.error(err);
  document.querySelectorAll(".chart:empty, .map:empty").forEach((c) => { c.innerHTML = `<p class="empty-state">Chart unavailable — data did not load.</p>`; });
  document.getElementById("main").insertAdjacentHTML("afterbegin",
    `<div class="wrap" style="padding:24px"><div class="card load-error" role="alert"><strong>Data failed to load.</strong> ${err.message}. ` +
    `If you opened index.html directly from disk, serve the docs/ folder over HTTP instead.</div></div>`);
});

export { BOROUGHS };
