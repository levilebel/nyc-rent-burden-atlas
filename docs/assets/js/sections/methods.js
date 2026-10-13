// Section E — Research questions, sources, calculations, validation results, limitations.
import { fmt } from "../util.js";

export function init({ registry, meta, boroughSummary }) {
  const nyc = boroughSummary["New York City"];
  const c = meta.counts;
  const statusLabel = { pass: "PASS", note: "NOTE", flag: "FLAG", fail: "FAIL" };

  document.getElementById("methods-content").innerHTML = `
  <div class="prose">
    <h3>Questions addressed</h3>
    <p>As reflected in the Homework 4 code and figures, the analysis asks:</p>
    <ol>
      <li>How does the share of rent-burdened renter households vary across New York City's five boroughs and ${c.nyc_zctas_valid} ZIP code areas?</li>
      <li>How does recorded affordable housing activity (HPD counted units per 1,000 renter households) line up with rent burden across ZIP codes?</li>
      <li>How is median household income associated with rent burden, within and across boroughs?</li>
      <li>Which ZIP codes combine high rent burden with low affordable housing activity, or with low income?</li>
    </ol>

    <h3>Data sources</h3>
    <div class="source-list">
      ${registry.sources.map((s) => `
        <div class="source-item">
          <h4>${s.name}</h4>
          <dl>
            <dt>Publisher</dt><dd>${s.publisher}</dd>
            ${s.table ? `<dt>Table / file</dt><dd>${s.table}</dd>` : ""}
            <dt>Vintage</dt><dd>${s.vintage}</dd>
            <dt>Geography</dt><dd>${s.geography}</dd>
            ${s.universe ? `<dt>Universe</dt><dd>${s.universe}</dd>` : ""}
            <dt>Used for</dt><dd>${s.used_for}</dd>
          </dl>
        </div>`).join("")}
    </div>

    <h3>Calculations</h3>
    <p><strong>ZIP-level rent burden</strong> (ACS B25070 columns 007–011):</p>
    <code class="formula">burdened = [30–34.9%] + [35–39.9%] + [40–49.9%] + [50%+]
denominator = total renter households − "not computed"
rent burden rate = burdened ÷ denominator × 100
severe rate = [50%+] ÷ denominator × 100</code>
    <p>"Not computed" covers renter households with no cash rent or with zero or negative income. Excluding them follows standard practice (HUD, Census).</p>
    <p><strong>Borough and citywide rates</strong> pool counts across ZCTAs (Σ burdened ÷ Σ denominator). They are not unweighted averages of ZIP rates.</p>
    <p><strong>Margins of error</strong> (added for this site): ACS publishes 90% MOEs for each bracket. Sums use the Census approximation √(Σ MOE²); proportions use
      MOE<sub>p</sub> = √(MOE<sub>num</sub>² − p²·MOE<sub>den</sub>²) ÷ den (ratio formula when the radicand is negative). The coefficient of variation is (MOE ÷ 1.645) ÷ estimate. These are the approximation formulas documented by the U.S. Census Bureau in <em>Understanding and Using American Community Survey Data</em> (2020), chapter 8.
      Every ± on this site is a <strong>90% MOE</strong>.</p>
    <p><strong>Reliability classes</strong> (one rule for maps, tables, charts and ZIP details): CV ≤ 15% High, 15–30% Moderate, &gt; 30% Low (⚠ "high statistical uncertainty").
      The class is computed from the unrounded CV, so a CV shown as "15.0%" can be Moderate (ZIP 10307: 15.002%). Borough classes apply the same rule to the pooled rate and its MOE.
      The approximations are least accurate for very small samples and zero estimates: ZIP 11697 (15 renter households) has an approximate MOE of ±163 points, larger than the possible range, and a zero estimate (10279) has no defined CV.</p>
    <p><strong>Estimates vs. counts.</strong> ACS figures (renter households, burden, income) are <em>survey estimates</em> with sampling error. HPD figures are <em>administrative counts</em> of units in recorded projects: they have no sampling error, but can be revised in later releases and depend on HPD's record-keeping.</p>
    <p><strong>Affordable housing intensity:</strong></p>
    <code class="formula">units per 1,000 = HPD "All Counted Units" in ZIP ÷ rent-burden denominator × 1,000</code>
    <p>HPD records are matched on their <code>Postcode</code>. ZIPs with no HPD records are set to 0, as in HW4. Borough totals use HPD's own <code>Borough</code> field, so they include records without a postcode.</p>
    <p><strong>HW4 pressure indices</strong> are <em>custom research indices</em> built in Homework 4. They are not official government statistics. They rank every ZIP with a computable rate:</p>
    <code class="formula">score = rank(rent burden, high→low) + rank(HPD units per 1,000, low→high)   [or rank(median income, low→high)]
index = 100 × (max score − score) ÷ (max score − min score)</code>
    <p>Ties use minimum rank. The indices are <em>relative</em>: 100 is the most pressured ZIP in this set, not an absolute threshold. The two components get equal weight by construction.</p>
    <p><strong>How to read it (review findings):</strong></p>
    <ul>
      <li><strong>Ties dominate the top 10.</strong> The 22 ZIPs with no HPD units all share the lowest-activity rank, and 9 of the top 10 come from this group.</li>
      <li><strong>Small samples.</strong> The index ignores sampling error. 11005 (84 renter households, ±35.5 pts) and 11697 (15, ±163 pts) are in the top 10.</li>
      <li><strong>Mixed populations.</strong> Counted units include homeownership units (18.4% of ZIP-matched units) but are divided by renter households.</li>
      <li><strong>Robustness.</strong> Alternative specifications keep 7–9 of the same top 10 (Spearman ρ ≥ 0.92 with the published index): average-rank ties, excluding CV &gt; 30% or ZIPs under 1,000 renter households, rental units only, 2:1 weighting, z-scores.</li>
      <li><strong>Not causal.</strong> A high score means high burden <em>alongside</em> little recorded HPD activity. It does not show that low production caused the burden or that more production would reduce it.</li>
    </ul>
    <p><strong>HW4 baseline stays the reference.</strong> The published HW4 index reproduces Homework 4 exactly and is not modified.</p>
    <p><strong>Exploratory alternative ranking</strong> (website addition, not Homework 4, shown as a separate option): the same formula, but ranked only among ZCTAs with reliable estimates
      (CV ≤ 30% and ≥ 1,000 renter households; 173 of 179) and using HPD <em>rental</em> units per 1,000 renter households, so numerator and denominator refer to renters.
      8 of its top 10 are also in the HW4 top 10. 11005 and 11697 drop out (small samples), and 11429 and 11416 enter. The ranking chart shows how each ZIP moves.
      It is a sensitivity view, not a corrected index, and it carries the same interpretation limits: different reference periods, ZCTAs vs. ZIP codes, and no causal meaning.</p>
    <p>Not applied (would need the author's approval): average ranks for ties, and renaming the index.</p>
    <p><strong>Income association:</strong> Pearson correlation and ordinary least squares slope of rent burden rate on median household income, by borough. These figures describe the data and do not identify cause and effect.</p>

    <h3>Validation results</h3>
    <p>The pipeline re-runs the HW4 logic from the raw files and checks the result. Borough rates match the HW4 figure (47.9 / 50.8 / 52.9 / 56.8 / 60.1%), and both HW4 top-10 lists match the HW4 charts in order.</p>
    <p>A separate script (<code>pipeline/verify_outputs.R</code>) recomputes the published numbers from the raw files with independent code. Each check is labelled
      <em>recomputation</em> (raw files vs. site), <em>reference</em> (vs. values transcribed from the HW4 figures or the HW3 file), or <em>internal consistency</em>.
      Descriptive lines are reported as information and are not counted as validations. The checks below come from the build pipeline itself.</p>
    <div class="checks">
      ${meta.checks.map((k) => `
        <div class="check"><span class="st ${k.status}">${statusLabel[k.status] || k.status}</span>
          <div><h4>${k.title}</h4><p>${k.detail}</p></div></div>`).join("")}
    </div>

    <h3>Definitions and limitations</h3>
    <ul>
      <li><strong>ZCTAs ≠ ZIP codes.</strong> Census ZIP Code Tabulation Areas approximate USPS delivery areas. HPD postcodes are USPS ZIPs. Matching them on the five-digit code is approximate, especially for ZIPs that cross borough lines.</li>
      <li><strong>ZIP 10463 and Marble Hill.</strong> Marble Hill is legally part of Manhattan (New York County) but lies on the Bronx mainland, inside ZIP 10463. HW4 assigns the whole ZIP to the Bronx. ACS data are not published for Marble Hill separately at this level, so its households are counted in the Bronx. HPD lists 5 buildings in 10463 under Manhattan.</li>
      <li><strong>Borough assignment</strong> uses HW4's ZIP ranges. ${fmt.int(c.nyc_zctas_assigned)} ZCTAs are assigned and ${c.nyc_zctas_valid} have computable rates. Two small Manhattan ZCTAs fall outside the ranges and are not included, matching HW4. 10162 (733 renter households; 51.6% ± 28.6 pts, CV 33.8%) and 10279 (84 renter households; 0 burdened, ±33.3 pts, a zero-count estimate). Both are surrounded only by Manhattan ZCTAs. 10162 is statistically unreliable; 10279 should not be read as a measured 0% burden. Including both would change Manhattan's rate by −0.002 points and the citywide rate by −0.002 points, and the borough order would not change (see the optional comparison in the Borough section). Both are drawn on the map with a cross-hatch, outside the study population.</li>
      <li><strong>Five-year estimates</strong> describe 2020–2024 pooled, not a single year. They include pandemic-era rents and incomes.</li>
      <li><strong>Different time frames:</strong> HPD counts cover projects started from ${c.hpd_project_start_min} to ${c.hpd_project_start_max}, while burden is a 2020–2024 snapshot. Units completed after a household was surveyed cannot have affected that household's burden.</li>
      <li><strong>HPD counts</strong> include preservation of existing units as well as new construction, and homeownership as well as rental units. "Counted" units are those credited toward the City's housing plans.</li>
      <li><strong>Income top-coding:</strong> ACS reports median income above $250,000 as "250,000+". HW4 treats these values as missing, so 3 high-income ZIPs drop out of income comparisons.</li>
      <li><strong>No causal claims.</strong> Correlations between production and burden reflect where the City has built and preserved housing. They do not show what effect that housing had.</li>
      <li>Totals: ${fmt.int(nyc.total_renter_households)} renter households in assigned ZCTAs, of which ${fmt.int(nyc.renter_households)} have computed burden. ${fmt.int(c.hpd_records_nyc)} HPD records, of which ${fmt.int(c.hpd_records_with_postcode)} have a postcode.</li>
    </ul>

    <h3>Reproducibility</h3>
    <p>All website data are generated by <code>pipeline/build_data.R</code>. The script reads the original assignment files read-only and writes JSON to <code>docs/data/</code> plus a validation report.
      Build: ${meta.build.generated}, ${meta.build.r_version}.</p>
    <p><strong>External dependencies.</strong> Charts use D3 7.9.0 from cdn.jsdelivr.net, with unpkg.com as an automatic fallback. If neither loads, the page shows a message and the text content remains readable, but charts and the theme toggle do not work.
      Fonts load from Google Fonts and fall back to system fonts. The data files are served with the site and need no external service.</p>
  </div>`;
}
