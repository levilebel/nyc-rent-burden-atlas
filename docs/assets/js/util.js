// Shared helpers: formatting, metric registry, colour scales, tooltip, responsive redraw.
/* global d3 */

export const BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"];

const fmtInt = d3.format(",.0f");
export const fmt = {
  int: (v) => (v == null || Number.isNaN(v) ? "—" : fmtInt(v)),
  pct: (v, d = 1) => (v == null || Number.isNaN(v) ? "—" : `${v.toFixed(d)}%`),
  usd: (v) => (v == null || Number.isNaN(v) ? "—" : `$${fmtInt(v)}`),
  dec: (v, d = 1) => (v == null || Number.isNaN(v) ? "—" : d3.format(`,.${d}f`)(v)),
  compact: (v) => (v == null ? "—" : Math.abs(v) >= 1e6 ? `${d3.format(".2~f")(v / 1e6)}M` : Math.abs(v) >= 1e4 ? `${d3.format(".0f")(v / 1e3)}K` : fmtInt(v)),
};

export const SRC = {
  acs: "Source: U.S. Census Bureau, ACS 2024 5-Year Estimates, Table B25070.",
  income: "Source: U.S. Census Bureau, ACS 2024 5-Year Estimates, Table B19013.",
  hpd: "Source: NYC HPD, Affordable Housing Production by Building (export 2026-10-12).",
  both: "Sources: ACS 2024 5-Year Estimates, Table B25070; NYC HPD Affordable Housing Production by Building.",
};

// One definition per measure — labels, units and sources stay consistent across every chart.
export const METRICS = {
  rent_burden_rate: { label: "Rent burden rate", unit: "% of renter households", fmt: (v) => fmt.pct(v), moe: "rent_burden_rate_moe", src: SRC.acs, kind: "pct" },
  severe_rent_burden_rate: { label: "Severe rent burden rate", unit: "% of renter households", fmt: (v) => fmt.pct(v), moe: "severe_rent_burden_rate_moe", src: SRC.acs, kind: "pct" },
  rent_burdened_households: { label: "Rent-burdened renter households", unit: "households", fmt: fmt.int, src: SRC.acs, kind: "count" },
  renter_households: { label: "Renter households (burden computed)", unit: "households", fmt: fmt.int, src: SRC.acs, kind: "count" },
  affordable_units: { label: "HPD counted affordable units", unit: "units (ZIP-matched records)", fmt: fmt.int, src: SRC.hpd, kind: "count" },
  affordable_units_per_1000: { label: "HPD affordable units per 1,000 renter households", unit: "units per 1,000", fmt: (v) => fmt.dec(v), src: SRC.both, kind: "rate", skew: true },
  hpd_units_per_1000_renters: { label: "HPD affordable units per 1,000 renter households", unit: "units per 1,000", fmt: (v) => fmt.dec(v), src: SRC.both + " Borough totals include HPD records without a postcode.", kind: "rate" },
  median_household_income: { label: "Median household income", unit: "2024 dollars", fmt: fmt.usd, src: SRC.income, kind: "usd" },
  pressure_index_hpd: { label: "Pressure index (custom, HW4): burden + low HPD activity", unit: "0–100, relative rank — not an official statistic", fmt: (v) => fmt.dec(v), src: SRC.both + " Custom research index from HW4 (rank-sum rescaled to 0–100); not an official statistic and not a causal measure.", kind: "index" },
  pressure_index_income: { label: "Pressure index (custom, HW4): burden + low income", unit: "0–100, relative rank — not an official statistic", fmt: (v) => fmt.dec(v), src: "Source: ACS 2024 5-Year, B25070 and B19013. Custom research index from HW4 (rank-sum rescaled to 0–100); not an official statistic and not a causal measure.", kind: "index" },
  pressure_index_alt: { label: "Alternative ranking (exploratory): reliable ZIPs, rental units only", unit: "0–100, relative rank among 173 ZCTAs — not HW4, not official", fmt: (v) => fmt.dec(v), src: SRC.both + " Exploratory alternative to the HW4 index: excludes CV > 30% and < 1,000 renter households; HPD rental units only. Not causal.", kind: "index" },
};

// ---------- theme-aware chart palettes ----------
// One blue family in both themes. Light mode: more = darker navy. Dark mode: the same
// ramp re-stepped so more = brighter (low values recede into the dark surface).
// Encodings are always paired with legends, labels or tooltips (never colour alone).
const THEMES = {
  light: {
    seq: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
    colors: {
      main: "#2a78d6", emph: "#0d366b", mid: "#256abf", soft: "#86b6ef", muted: "#c5cfdc", highlight: "#f2a900",
      ink: "#0d1b2e", surface: "#ffffff", hatchA: "#e9edf2", hatchB: "#c7d0dc",
      b30: "#86b6ef", b35: "#5598e7", b40: "#256abf", b50: "#0d366b",
      nc: "#184f95", pres: "#86b6ef",
      bands: ["#0d366b", "#184f95", "#256abf", "#5598e7", "#86b6ef", "#98a3b3"],
      // diverging for the simulation change map: blue = pressure falls, neutral grey = no change, orange = rises
      divNeg: ["#0d366b", "#256abf", "#86b6ef"], divZero: "#e4e2dd", divPos: ["#f4c2a1", "#e0814f", "#b4501f"],
    },
  },
  dark: {
    seq: ["#1b467e", "#1f62b5", "#2f7ddb", "#5598e7", "#86b6ef", "#b7d3f6", "#e3eefb"],
    colors: {
      main: "#4c9bff", emph: "#cfe3fb", mid: "#86b6ef", soft: "#2a6cc6", muted: "#3d5679", highlight: "#ffc233",
      ink: "#e9eff8", surface: "#12274a", hatchA: "#17305a", hatchB: "#2a4874",
      b30: "#1f5fb0", b35: "#3f86e0", b40: "#78aef0", b50: "#cfe3fb",
      nc: "#9ec5f4", pres: "#2f6fc4",
      bands: ["#eef5fd", "#a9cbf5", "#6fa8ee", "#3f86e0", "#1f5fb0", "#6f7f97"],
      divNeg: ["#cfe3fb", "#5598e7", "#1f5fb0"], divZero: "#33415a", divPos: ["#7a4528", "#c76a3a", "#f0a77c"],
    },
  },
};
export const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
// COLORS.x always resolves against the active theme.
export const COLORS = new Proxy({}, { get: (_, k) => THEMES[currentTheme()].colors[k] });
export const seq = () => THEMES[currentTheme()].seq;
export const BRACKETS = [
  { key: "rent_30_34", label: "30–34.9%", get color() { return COLORS.b30; } },
  { key: "rent_35_39", label: "35–39.9%", get color() { return COLORS.b35; } },
  { key: "rent_40_49", label: "40–49.9%", get color() { return COLORS.b40; } },
  { key: "rent_50_plus", label: "50% or more (severe)", get color() { return COLORS.b50; } },
];

// ---------- tooltip ----------
const tipEl = () => document.getElementById("tooltip");
export function showTip(event, html) {
  const el = tipEl();
  el.innerHTML = html;
  el.hidden = false;
  moveTip(event);
}
export function moveTip(event) {
  const el = tipEl();
  const pad = 14;
  const { innerWidth: w, innerHeight: h } = window;
  const r = el.getBoundingClientRect();
  let x = (event.clientX ?? 0) + pad;
  let y = (event.clientY ?? 0) + pad;
  if (event.clientX == null && event.target?.getBoundingClientRect) {
    const b = event.target.getBoundingClientRect();
    x = b.right + pad; y = b.top;
  }
  if (x + r.width > w - 8) x = Math.max(8, x - r.width - 2 * pad);
  if (y + r.height > h - 8) y = Math.max(8, h - r.height - 8);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}
export function hideTip() { tipEl().hidden = true; }
export function tipRows(title, rows, note) {
  return `<div class="tt-title">${title}</div>` +
    rows.filter(Boolean).map(([k, v]) => `<div class="tt-row"><span>${k}</span><span>${v}</span></div>`).join("") +
    (note ? `<div class="tt-note">${note}</div>` : "");
}
// ---------- sampling uncertainty (existing site rule: CV = (MOE / 1.645) / estimate) ----------
// CV ≤ 15% → High, 15–30% → Moderate, > 30% → Low. Same thresholds as pipeline/build_data.R.
// Single vocabulary for reliability, used by maps, tables, charts and ZIP details.
export const REL_LABEL = { good: "High", moderate: "Moderate", low: "Low" };
export const relText = (cls) => REL_LABEL[cls] || "n/a";
// "± x pts (90% MOE)" — every displayed margin of error is labelled as a 90% MOE.
export const moeText = (moe) => (moe == null ? "—" : `± ${fmt.dec(moe)} pts (90% MOE)`);
export const reliabilityClass = (cv) => (cv == null || !Number.isFinite(cv) ? null : cv > 30 ? "low" : cv > 15 ? "moderate" : "good");
export const cvOf = (rate, moe) => (rate > 0 && moe != null ? (moe / 1.645) / rate * 100 : null);
// Extra tooltip rows: "90% margin of error" and "Reliability". Returns [] when no estimate exists.
export function uncertaintyRows({ moe, cv, cls }) {
  cls = cls || reliabilityClass(cv);
  if (moe == null || !cls || cls === "none") return [];
  return [
    ["90% margin of error (MOE)", `± ${fmt.dec(moe)} pts`],
    ["Reliability", `${REL_LABEL[cls]}${cv != null ? ` (CV ${fmt.dec(cv)}%)` : ""}`],
  ];
}
// Text warning (never colour alone) for estimates with high statistical uncertainty.
export function uncertaintyWarning(cls) {
  return cls === "low" ? "⚠ High statistical uncertainty (CV > 30%): interpret this estimate with caution." : null;
}
export const joinNotes = (...notes) => notes.filter(Boolean).join("<br>") || null;

// Attach hover + keyboard-focus tooltips to a d3 selection.
export function bindTip(sel, htmlFn) {
  sel.attr("tabindex", 0)
    .on("mouseenter focus", (e, d) => showTip(e, htmlFn(d)))
    .on("mousemove", moveTip)
    .on("mouseleave blur", hideTip);
}

// ---------- responsive + theme redraw ----------
const drawers = [];
const themeListeners = [];
// Register non-chart UI (legends etc.) that must re-render when the theme changes.
export function onTheme(fn) { themeListeners.push(fn); fn(); }
// Re-render every chart and legend at its current width (used after a theme switch).
export function redrawAll() {
  drawers.forEach(({ el, draw }) => { const w = Math.round(el.clientWidth); if (w) draw(w); });
  themeListeners.forEach((fn) => fn());
}
export function onResize(el, draw) {
  drawers.push({ el, draw });
  let last = 0;
  const ro = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w && Math.abs(w - last) > 4) { last = w; draw(w); }
  });
  ro.observe(el);
  // Draw once immediately: ResizeObserver callbacks only run on rendered frames.
  const w0 = Math.round(el.clientWidth);
  if (w0) { last = w0; draw(w0); }
  return ro;
}

export function legend(el, items) {
  el.innerHTML = items.map((i) =>
    `<span class="key"><span class="sw ${i.type || ""}" style="${i.color ? `background:${i.color}` : ""}"></span>${i.label}</span>`).join("");
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
