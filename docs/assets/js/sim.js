// Policy simulation engine — pure functions, no DOM.
//
// Recomputes the HW4 affordability pressure index exactly as pipeline/build_data.R does:
//   rate      = rent_burdened_households / renter_households * 100
//   per1000   = affordable_units / renter_households * 1000
//   score     = min_rank(desc(rate)) + min_rank(per1000)
//   index     = 100 * (max(score) - score) / (max(score) - min(score))
// using the published integer counts in docs/data/zip_data.json (same operation order as R,
// so the baseline reproduces the published index; the simulator checks this on load).
//
// A scenario adds a hypothetical number of units per 1,000 renter households to selected ZIPs
// and recomputes the index. Rent burden is held constant: the simulation shows how the
// relative index responds, not how rent burden would change.

// dplyr::min_rank: 1 + number of values strictly better; ties share the lowest rank.
function minRank(values, { descending = false } = {}) {
  return values.map((v) => 1 + values.reduce((n, w) => n + (descending ? w > v : w < v), 0));
}

// Rows used by the index: ZCTAs with a computable rent-burden rate (HW4 study population).
export function indexRows(zipData) {
  return zipData
    .filter((z) => z.renter_households > 0)
    .map((z) => ({
      zip: z.zip,
      borough: z.borough,
      renters: z.renter_households,
      units: z.affordable_units,
      rate: (z.rent_burdened_households / z.renter_households) * 100,
      per1000: (z.affordable_units / z.renter_households) * 1000,
      reliability: z.reliability,
      published: z.pressure_index_hpd,
    }));
}

// HW4 index for rows, with an optional per-ZIP activity override. Returns Map zip -> result.
export function pressureIndex(rows, per1000Of = (r) => r.per1000) {
  const act = rows.map(per1000Of);
  const rb = minRank(rows.map((r) => r.rate), { descending: true });
  const la = minRank(act);
  const score = rows.map((_, i) => rb[i] + la[i]);
  const max = Math.max(...score), min = Math.min(...score);
  return new Map(rows.map((r, i) => [r.zip, {
    index: (100 * (max - score[i])) / (max - min), score: score[i], burdenRank: rb[i], activityRank: la[i], per1000: act[i],
  }]));
}

// Ranked list (most pressured first); ties keep the data order, like dplyr::arrange.
export function ranking(rows, result) {
  return rows.map((r, i) => ({ zip: r.zip, i, score: result.get(r.zip).score }))
    .sort((a, b) => a.score - b.score || a.i - b.i).map((d) => d.zip);
}

// Target groups a user can choose. Each returns a Set of ZIPs from the CURRENT (baseline) state.
export function targetSet(rows, baseline, target) {
  const order = ranking(rows, baseline);
  if (target === "all") return new Set(rows.map((r) => r.zip));
  if (target.startsWith("top")) return new Set(order.slice(0, Number(target.slice(3))));
  if (target === "zero") return new Set(rows.filter((r) => r.units === 0).map((r) => r.zip));
  if (target === "above_median") {
    const idx = rows.map((r) => baseline.get(r.zip).index).sort((a, b) => a - b);
    const mid = idx.length % 2 ? idx[(idx.length - 1) / 2] : (idx[idx.length / 2 - 1] + idx[idx.length / 2]) / 2;
    return new Set(rows.filter((r) => baseline.get(r.zip).index > mid).map((r) => r.zip));
  }
  if (target.startsWith("borough:")) { const b = target.slice(8); return new Set(rows.filter((r) => r.borough === b).map((r) => r.zip)); }
  throw new Error(`Unknown target ${target}`);
}

// Run one scenario. Returns per-ZIP before/after plus summary figures (all derived from data).
export function simulate(rows, { delta, target }) {
  const baseline = pressureIndex(rows);
  const targets = targetSet(rows, baseline, target);
  const projected = pressureIndex(rows, (r) => r.per1000 + (targets.has(r.zip) ? delta : 0));
  // Pressure rank = position in the ranking (1 = highest pressure); easier to read than the rescaled 0–100 index.
  const posBefore = new Map(ranking(rows, baseline).map((zp, i) => [zp, i + 1]));
  const posAfter = new Map(ranking(rows, projected).map((zp, i) => [zp, i + 1]));
  const perZip = rows.map((r) => {
    const b = baseline.get(r.zip), p = projected.get(r.zip);
    return { ...r, targeted: targets.has(r.zip), before: b.index, after: p.index, change: p.index - b.index,
      rankBefore: posBefore.get(r.zip), rankAfter: posAfter.get(r.zip),
      beforeRanks: [b.burdenRank, b.activityRank], afterRanks: [p.burdenRank, p.activityRank], per1000After: p.per1000 };
  });
  const tz = perZip.filter((z) => z.targeted), other = perZip.filter((z) => !z.targeted);
  const mean = (a, f) => (a.length ? a.reduce((s, z) => s + f(z), 0) / a.length : 0);
  const topBefore = ranking(rows, baseline).slice(0, 10), topAfter = ranking(rows, projected).slice(0, 10);
  return {
    delta, target, perZip, topBefore, topAfter,
    summary: {
      targeted: tz.length,
      // Hypothetical units implied by the scenario: delta per 1,000 renter households in each targeted ZIP.
      impliedUnits: tz.reduce((s, z) => s + (delta * z.renters) / 1000, 0),
      meanBeforeTargeted: mean(tz, (z) => z.before),
      meanAfterTargeted: mean(tz, (z) => z.after),
      meanRankBeforeTargeted: mean(tz, (z) => z.rankBefore),
      meanRankAfterTargeted: mean(tz, (z) => z.rankAfter),
      othersRose: other.filter((z) => z.change > 0.05).length,
      othersFell: other.filter((z) => z.change < -0.05).length,
      maxOtherRise: Math.max(0, ...other.map((z) => z.change)),
      leftTop10: topBefore.filter((zp) => !topAfter.includes(zp)),
      enteredTop10: topAfter.filter((zp) => !topBefore.includes(zp)),
    },
  };
}

// Self-check: baseline recomputed in the browser must equal the published HW4 index.
export function checkBaseline(rows, publishedTop10) {
  const b = pressureIndex(rows);
  const maxDiff = Math.max(...rows.map((r) => Math.abs(Math.round(b.get(r.zip).index * 10) / 10 - r.published)));
  const top = ranking(rows, b).slice(0, 10);
  return { ok: maxDiff < 0.051 && top.join() === publishedTop10.join(), maxDiff, top };
}
