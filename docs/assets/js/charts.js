// Reusable D3 chart components. Each takes a container element and a config,
// clears the container and draws at the container's current width.
/* global d3 */
import { bindTip, COLORS } from "./util.js";

const BAR_MAX = 24; // px: bars never thicker than this

function svgFor(el, width, height) {
  d3.select(el).selectAll("*").remove();
  return d3.select(el).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width).attr("height", height)
    .attr("role", "img");
}

// Bar path: square at the baseline, 4px rounded data-end.
function hBarPath(x0, x1, y, h, r = 4) {
  const w = x1 - x0;
  if (w <= 0) return "";
  r = Math.min(r, w, h / 2);
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
}
function vBarPath(x, y1, w, y0, r = 4) {
  const h = y0 - y1;
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
}

function measureLabel(rows, font = "500 12.5px Inter") {
  const c = measureLabel.c || (measureLabel.c = document.createElement("canvas").getContext("2d"));
  c.font = font;
  return d3.max(rows, (r) => c.measureText(r).width) || 0;
}

/**
 * Horizontal bar chart (one series).
 * data: [{label, value, moe?, highlight?, tip, note?, warn?}]
 * `note` is drawn as a visible caption line under the bar (e.g. sample size and 90% MOE);
 * `warn` prefixes it with ⚠ and bold text — uncertainty is never shown in the tooltip only.
 */
export function hBars(el, { data, width, fmt, xTitle, ariaLabel, ref }) {
  const labelW = Math.min(150, measureLabel(data.map((d) => d.label)) + 12);
  const m = { top: 8, right: 64, bottom: 44, left: labelW };
  const hasNotes = data.some((d) => d.note);
  // Wrap each note at its " · " separators so it always fits the chart width (mobile included).
  const noteFont = "600 11px Inter";
  data.forEach((d) => {
    if (!d.note) return;
    const parts = `${d.warn ? "⚠ " : ""}${d.note}`.split(" · ");
    d._lines = [];
    let line = "";
    parts.forEach((p) => {
      const next = line ? `${line} · ${p}` : p;
      if (line && measureLabel([next], noteFont) > width - 12) { d._lines.push(line); line = p; } else line = next;
    });
    d._lines.push(line);
  });
  const noteLines = d3.max(data, (d) => (d._lines ? d._lines.length : 0)) || 0;
  const band = hasNotes ? 44 + 14 * noteLines : 40;
  const height = m.top + m.bottom + band * data.length;
  const svg = svgFor(el, width, height).attr("aria-label", ariaLabel);
  const maxV = d3.max(data, (d) => d.value + (d.moe || 0));
  const x = d3.scaleLinear().domain([0, maxV * 1.05]).nice().range([m.left, width - m.right]);
  const y = d3.scaleBand().domain(data.map((d) => d.label)).range([m.top, height - m.bottom]).paddingInner(hasNotes ? 0.1 : 0.3);
  const bh = Math.min(BAR_MAX, hasNotes ? 20 : y.bandwidth());
  // with notes, the bar sits in the top of its band and the note line below it
  const barTop = (d) => (hasNotes ? y(d.label) + 2 : y(d.label) + (y.bandwidth() - bh) / 2);
  const mid = (d) => barTop(d) + bh / 2;

  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - m.left - m.right) / 90))).tickSize(-(height - m.top - m.bottom)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - m.left - m.right) / 90))).tickFormat(d3.format(",~r")).tickSize(0).tickPadding(8));
  if (xTitle) svg.append("text").attr("class", "axis-title").attr("x", width - m.right).attr("y", height - 4).attr("text-anchor", "end").text(xTitle);

  if (ref != null) {
    svg.append("line").attr("class", "ref-line").attr("x1", x(ref.value)).attr("x2", x(ref.value)).attr("y1", m.top - 4).attr("y2", height - m.bottom);
  }

  const g = svg.append("g").selectAll("g").data(data).join("g");
  g.append("text").attr("class", "cat-label").attr("x", m.left - 10).attr("y", mid).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.label);
  const bar = g.append("path")
    .attr("d", (d) => hBarPath(x(0), x(d.value), barTop(d), bh))
    .attr("fill", (d) => (d.highlight ? COLORS.emph : COLORS.main));
  // error bars
  g.filter((d) => d.moe).append("path")
    .attr("d", (d) => {
      const cy = mid(d), a = x(d.value - d.moe), b = x(d.value + d.moe);
      return `M${a},${cy - 5}V${cy + 5}M${a},${cy}H${b}M${b},${cy - 5}V${cy + 5}`;
    })
    .attr("stroke", COLORS.ink).attr("stroke-width", 1.2).attr("fill", "none").attr("pointer-events", "none");
  g.append("text").attr("class", "value-label")
    .attr("x", (d) => x(d.value + (d.moe || 0)) + 8).attr("y", mid).attr("dy", "0.35em")
    .text((d) => fmt(d.value));
  if (hasNotes) {
    const notes = g.filter((d) => d.note).append("text")
      .attr("class", (d) => `bar-note${d.warn ? " warn" : ""}`)
      .attr("x", 4).attr("y", (d) => barTop(d) + bh + 15);
    notes.selectAll("tspan").data((d) => d._lines).join("tspan")
      .attr("x", 4).attr("dy", (_, i) => (i === 0 ? 0 : 14)).text((t) => t);
  }
  // generous hit target
  const hit = g.append("rect").attr("x", m.left).attr("width", width - m.left - m.right)
    .attr("y", (d) => y(d.label)).attr("height", y.bandwidth()).attr("fill", "transparent");
  bindTip(hit, (d) => d.tip);
  hit.on("mouseenter.hl", (e, d) => bar.attr("opacity", (b) => (b === d ? 1 : 0.55)))
    .on("mouseleave.hl", () => bar.attr("opacity", 1));
}

/**
 * Horizontal stacked bars.
 * rows: [{label, segs:[{key, value}], tip(seg,row)}]; series: [{key, label, color}]
 */
export function stackedH(el, { rows, series, width, fmt, xMax, xTitle, ariaLabel, totalLabel, ref }) {
  const labelW = Math.min(150, measureLabel(rows.map((d) => d.label)) + 12);
  const m = { top: 8, right: totalLabel ? 56 : 16, bottom: 44, left: labelW };
  const band = 40;
  const height = m.top + m.bottom + band * rows.length;
  const svg = svgFor(el, width, height).attr("aria-label", ariaLabel);
  const totals = rows.map((r) => d3.sum(r.segs, (s) => s.value));
  const x = d3.scaleLinear().domain([0, xMax ?? d3.max(totals)]).nice().range([m.left, width - m.right]);
  const y = d3.scaleBand().domain(rows.map((d) => d.label)).range([m.top, height - m.bottom]).paddingInner(0.3);
  const bh = Math.min(BAR_MAX, y.bandwidth());
  const ticks = Math.max(2, Math.floor((width - m.left - m.right) / 90));

  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(ticks).tickSize(-(height - m.top - m.bottom)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(ticks).tickFormat(fmt.axis || d3.format(",~s")).tickSize(0).tickPadding(8));
  if (xTitle) svg.append("text").attr("class", "axis-title").attr("x", width - m.right).attr("y", height - 4).attr("text-anchor", "end").text(xTitle);

  const color = new Map(series.map((s) => [s.key, s.color]));
  rows.forEach((row, i) => {
    const yy = y(row.label) + (y.bandwidth() - bh) / 2;
    const g = svg.append("g");
    g.append("text").attr("class", "cat-label").attr("x", m.left - 10).attr("y", y(row.label) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(row.label);
    let acc = 0;
    const segs = row.segs.filter((s) => s.value > 0).map((s) => { const o = { ...s, x0: acc, x1: acc + s.value }; acc += s.value; return o; });
    const last = segs.length - 1;
    const paths = g.selectAll("path").data(segs).join("path")
      .attr("d", (s, j) => {
        const a = x(s.x0) + (j > 0 ? 1 : 0), b = x(s.x1) - (j < last ? 1 : 0); // 2px surface gap
        return j === last ? hBarPath(a, b, yy, bh) : `M${a},${yy}H${b}V${yy + bh}H${a}Z`;
      })
      .attr("fill", (s) => color.get(s.key));
    bindTip(paths, (s) => row.tip(s, row));
    if (totalLabel) g.append("text").attr("class", "value-label").attr("x", x(totals[i]) + 8).attr("y", y(row.label) + y.bandwidth() / 2).attr("dy", "0.35em").text(totalLabel(row, totals[i]));
  });
  if (ref) {
    svg.append("line").attr("class", "ref-line").attr("x1", x(ref.value)).attr("x2", x(ref.value)).attr("y1", m.top - 4).attr("y2", height - m.bottom);
  }
}

/**
 * Dot strip: one row per group, dots positioned by value (jittered vertically by rank).
 * data: [{group, value, unreliable, tip}], marks: [{group, value, label}]
 */
export function strip(el, { data, groups, width, xTitle, marks, onClick, ariaLabel, xDomain }) {
  const labelW = Math.min(110, measureLabel(groups) + 12);
  const m = { top: 10, right: 16, bottom: 44, left: labelW };
  const band = 54;
  const height = m.top + m.bottom + band * groups.length;
  const svg = svgFor(el, width, height).attr("aria-label", ariaLabel);
  const x = d3.scaleLinear().domain(xDomain || d3.extent(data, (d) => d.value)).nice().range([m.left, width - m.right]);
  const y = d3.scaleBand().domain(groups).range([m.top, height - m.bottom]).paddingInner(0.15);
  const ticks = Math.max(2, Math.floor((width - m.left - m.right) / 70));
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(ticks).tickSize(-(height - m.top - m.bottom)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).ticks(ticks).tickFormat((v) => `${v}%`).tickSize(0).tickPadding(8));
  if (xTitle) svg.append("text").attr("class", "axis-title").attr("x", width - m.right).attr("y", height - 4).attr("text-anchor", "end").text(xTitle);

  groups.forEach((gname) => {
    svg.append("text").attr("class", "cat-label").attr("x", m.left - 10).attr("y", y(gname) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(gname);
  });
  // simple beeswarm-ish layout: offset dots that are within 7px of a neighbour
  const placed = [];
  groups.forEach((gname) => {
    const pts = data.filter((d) => d.group === gname).sort((a, b) => a.value - b.value);
    const lanes = [];
    pts.forEach((p) => {
      const px = x(p.value);
      let lane = 0;
      while (lanes[lane] != null && px - lanes[lane] < 9) lane++;
      lanes[lane] = px;
      const off = (lane % 2 ? 1 : -1) * Math.ceil(lane / 2) * 8;
      placed.push({ ...p, px, py: y(gname) + y.bandwidth() / 2 + Math.max(-y.bandwidth() / 2 + 5, Math.min(y.bandwidth() / 2 - 5, off)) });
    });
  });
  (marks || []).forEach((mk) => {
    const cy = y(mk.group) + y.bandwidth() / 2;
    svg.append("line").attr("x1", x(mk.value)).attr("x2", x(mk.value)).attr("y1", cy - y.bandwidth() / 2 + 2).attr("y2", cy + y.bandwidth() / 2 - 2)
      .attr("stroke", COLORS.emph).attr("stroke-width", 2);
  });
  const dots = svg.append("g").selectAll("circle").data(placed).join("circle")
    .attr("cx", (d) => d.px).attr("cy", (d) => d.py).attr("r", 4.5)
    .attr("fill", (d) => (d.unreliable ? COLORS.surface : COLORS.main))
    .attr("stroke", (d) => (d.unreliable ? COLORS.mid : COLORS.surface))
    .attr("stroke-width", (d) => (d.unreliable ? 1.8 : 1.5))
    .style("cursor", onClick ? "pointer" : null);
  bindTip(dots, (d) => d.tip);
  if (onClick) dots.on("click keydown", (e, d) => { if (e.type === "click" || e.key === "Enter") onClick(d); });
}

/**
 * Scatter plot.
 * data: [{x, y, id, active, selected, unreliable, tip}]
 */
export function scatter(el, { data, width, xTitle, yTitle, xFmt, yFmt, xType = "linear", trend, medians, onClick, ariaLabel, height: hIn }) {
  const height = hIn || Math.max(280, Math.min(420, width * 0.72));
  const m = { top: 12, right: 18, bottom: 46, left: 52 };
  const svg = svgFor(el, width, height).attr("aria-label", ariaLabel);
  const xs = xType === "sqrt" ? d3.scaleSqrt() : d3.scaleLinear();
  const x = xs.domain([xType === "sqrt" ? 0 : d3.min(data, (d) => d.x) * 0.95, d3.max(data, (d) => d.x) * 1.03]).nice().range([m.left, width - m.right]);
  const y = d3.scaleLinear().domain(d3.extent(data, (d) => d.y)).nice().range([height - m.bottom, m.top]);
  const xt = Math.max(2, Math.floor((width - m.left - m.right) / 80));

  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(xt).tickSize(-(height - m.top - m.bottom)).tickFormat(""));
  svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(width - m.left - m.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(xt).tickFormat(xFmt).tickSize(0).tickPadding(8));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(yFmt).tickSize(0).tickPadding(8));
  svg.append("text").attr("class", "axis-title").attr("x", width - m.right).attr("y", height - 6).attr("text-anchor", "end").text(xTitle);
  svg.append("text").attr("class", "axis-title").attr("x", -m.top).attr("y", 12).attr("transform", "rotate(-90)").attr("text-anchor", "end").text(yTitle);

  if (medians) {
    svg.append("line").attr("class", "ref-line").attr("x1", x(medians.x)).attr("x2", x(medians.x)).attr("y1", m.top).attr("y2", height - m.bottom);
    svg.append("line").attr("class", "ref-line").attr("x1", m.left).attr("x2", width - m.right).attr("y1", y(medians.y)).attr("y2", y(medians.y));
    svg.append("text").attr("class", "ref-label").attr("x", x(medians.x) + 4).attr("y", m.top + 10).text("NYC median");
  }
  if (trend) {
    const [a, b] = x.domain();
    const lo = Math.max(a, trend.xMin ?? a), hi = Math.min(b, trend.xMax ?? b);
    svg.append("line").attr("x1", x(lo)).attr("x2", x(hi)).attr("y1", y(trend.intercept + trend.slope * lo)).attr("y2", y(trend.intercept + trend.slope * hi))
      .attr("stroke", COLORS.emph).attr("stroke-width", 2).attr("stroke-linecap", "round").attr("pointer-events", "none");
  }
  const sorted = [...data].sort((a, b) => (a.active === b.active ? (a.selected ? 1 : 0) - (b.selected ? 1 : 0) : a.active ? 1 : -1));
  const dots = svg.append("g").selectAll("circle").data(sorted).join("circle")
    .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y))
    .attr("r", (d) => (d.selected ? 6.5 : 4.5))
    .attr("fill", (d) => (d.selected ? COLORS.highlight : d.active ? COLORS.main : COLORS.muted))
    .attr("fill-opacity", (d) => (d.active || d.selected ? 0.9 : 0.7))
    .attr("stroke", (d) => (d.selected ? COLORS.emph : COLORS.surface)).attr("stroke-width", (d) => (d.selected ? 1.5 : 1.5))
    .style("cursor", onClick ? "pointer" : null);
  bindTip(dots, (d) => d.tip);
  if (onClick) dots.on("click keydown", (e, d) => { if (e.type === "click" || e.key === "Enter") onClick(d); });
}

/**
 * Stacked columns over an ordinal x (years).
 * rows: [{x, segs:[{key,value}]}]
 */
export function stackedColumns(el, { rows, series, width, yTitle, ariaLabel, tip, partial }) {
  const height = Math.max(240, Math.min(340, width * 0.4));
  const m = { top: 14, right: 12, bottom: 34, left: 52 };
  const svg = svgFor(el, width, height).attr("aria-label", ariaLabel);
  const x = d3.scaleBand().domain(rows.map((r) => r.x)).range([m.left, width - m.right]).paddingInner(0.25);
  const totals = rows.map((r) => d3.sum(r.segs, (s) => s.value));
  const y = d3.scaleLinear().domain([0, d3.max(totals)]).nice().range([height - m.bottom, m.top]);
  const bw = Math.min(BAR_MAX + 8, x.bandwidth());
  svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",~s")).tickSize(0).tickPadding(8));
  const every = Math.ceil(rows.length / Math.max(2, Math.floor((width - m.left) / 42)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % every === 0)).tickSize(0).tickPadding(8));
  if (yTitle) svg.append("text").attr("class", "axis-title").attr("x", -m.top).attr("y", 12).attr("transform", "rotate(-90)").attr("text-anchor", "end").text(yTitle);
  const color = new Map(series.map((s) => [s.key, s.color]));
  rows.forEach((r) => {
    let acc = 0;
    const segs = r.segs.filter((s) => s.value > 0).map((s) => { const o = { ...s, y0: acc, y1: acc + s.value }; acc += s.value; return o; });
    const last = segs.length - 1;
    const x0 = x(r.x) + (x.bandwidth() - bw) / 2;
    const g = svg.append("g");
    g.selectAll("path").data(segs).join("path")
      .attr("d", (s, j) => {
        const top = y(s.y1) + (j < last ? 1 : 0), bot = y(s.y0) - (j > 0 ? 1 : 0);
        return j === last ? vBarPath(x0, top, bw, bot) : `M${x0},${bot}V${top}H${x0 + bw}V${bot}Z`;
      })
      .attr("fill", (s) => color.get(s.key))
      .attr("opacity", partial && partial(r) ? 0.55 : 1);
    const hit = g.append("rect").attr("x", x(r.x)).attr("width", x.bandwidth()).attr("y", m.top).attr("height", height - m.top - m.bottom).attr("fill", "transparent").datum(r);
    bindTip(hit, tip);
  });
}
