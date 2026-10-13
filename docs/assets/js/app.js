// Entry point: load processed data, then initialise each section module.
// To add a section: create assets/js/sections/<name>.js exporting init(ctx),
// add its markup to index.html, and register it in SECTIONS below.
import { BOROUGHS, redrawAll, currentTheme, hideTip } from "./util.js";
import * as overview from "./sections/overview.js";
import * as boroughs from "./sections/boroughs.js";
import * as zips from "./sections/zips.js";
import * as housing from "./sections/housing.js";
import * as methods from "./sections/methods.js";
import * as research from "./sections/research.js";

const SECTIONS = [overview, boroughs, zips, housing, methods, research];

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
  const [zipData, boroughSummary, hpdYear, stats, meta, registry, zcta, outlines, altRanking, excluded] = await Promise.all([
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
    zipData, zipIndex, hpdYear, stats, meta, registry, zcta, outlines, altRanking, excluded, store, BOROUGHS,
    boroughSummary: Object.fromEntries(boroughSummary.map((b) => [b.borough, b])),
  };
  for (const s of SECTIONS) {
    try { s.init(ctx); } catch (err) { console.error(err); }
  }
  document.getElementById("build-info").textContent =
    `Data build ${meta.build.generated} · ${meta.build.pipeline} · reproduces ${meta.build.reproduces.split("/").pop()}`;
}

// ---------- theme ----------
// The inline script in <head> sets data-theme before first paint. Here: toggle,
// persistence (localStorage), following the OS while no choice is saved, and redraw.
const THEME_KEY = "atlas-theme";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function syncToggle() {
  const btn = document.getElementById("theme-toggle");
  const dark = currentTheme() === "dark";
  // Accessible name describes the action the button will perform (not a pressed state).
  const action = dark ? "Switch to light mode" : "Switch to dark mode";
  btn.setAttribute("aria-label", action);
  btn.title = action;
}

function setTheme(theme, { persist }) {
  const root = document.documentElement;
  if (theme === currentTheme()) return;
  if (!reduceMotion.matches) {
    root.classList.add("theme-anim");
    clearTimeout(setTheme.t);
    setTheme.t = setTimeout(() => root.classList.remove("theme-anim"), 350);
  }
  root.setAttribute("data-theme", theme);
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable: theme still applies for this visit */ }
    root.setAttribute("data-theme-source", "user");
  }
  hideTip();
  syncToggle();
  redrawAll(); // charts and legends read the palette at draw time; no data is recomputed
}

function initTheme() {
  syncToggle();
  document.getElementById("theme-toggle").addEventListener("click", () =>
    setTheme(currentTheme() === "dark" ? "light" : "dark", { persist: true }));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (document.documentElement.getAttribute("data-theme-source") !== "user") setTheme(e.matches ? "dark" : "light", { persist: false });
  });
}

// ---------- navigation ----------
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });
  const links = [...nav.querySelectorAll("a")];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${en.target.id}`));
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  links.forEach((a) => { const t = document.querySelector(a.getAttribute("href")); if (t) io.observe(t); });
}

initNav();
initTheme();
main().catch((err) => {
  console.error(err);
  document.querySelectorAll(".chart:empty, .map:empty").forEach((c) => { c.innerHTML = `<p class="empty-state">Chart unavailable — data did not load.</p>`; });
  document.getElementById("main").insertAdjacentHTML("afterbegin",
    `<div class="wrap" style="padding:24px"><div class="card load-error" role="alert"><strong>Data failed to load.</strong> ${err.message}. ` +
    `If you opened index.html directly from disk, serve the docs/ folder over HTTP instead.</div></div>`);
});

export { BOROUGHS };
