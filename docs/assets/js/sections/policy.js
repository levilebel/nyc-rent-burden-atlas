// Section — Policy context. Rendered from docs/content/policy.json.
// Only entries with a source URL and a verification date are shown; everything else stays a placeholder,
// so no unverified legal or programme claims can appear on the site.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isVerified = (it) => /^https?:\/\//.test(it.source_url || "") && /^\d{4}-\d{2}-\d{2}$/.test(it.verified_on || "");

export function init({ policyContent }) {
  const el = document.getElementById("policy-content");
  el.innerHTML = policyContent.categories.map((cat) => {
    const items = (cat.items || []).filter(isVerified);
    const body = items.length
      ? `<ul class="policy-items">${items.map((it) => `
          <li>
            <h4>${esc(it.name)}</h4>
            <p class="policy-meta">${[it.level, it.type, it.status].filter(Boolean).map(esc).join(" · ")}</p>
            <p>${esc(it.summary)}</p>
            ${it.relevance ? `<p><strong>Connection to this analysis:</strong> ${esc(it.relevance)}</p>` : ""}
            <p class="source">Source: <a href="${esc(it.source_url)}" target="_blank" rel="noopener">${esc(it.source_name || it.source_url)}</a> · verified ${esc(it.verified_on)}</p>
          </li>`).join("")}</ul>`
      : `<p class="policy-placeholder">Verified entries will be added here. <span>Placeholder — no policy information has been entered yet.</span></p>`;
    return `
      <article class="card policy-card">
        <h3 class="card-title">${esc(cat.title)}</h3>
        <p class="card-sub">${esc(cat.description)}</p>
        <p class="policy-meta">Relates to: ${(cat.relates_to || []).map(esc).join(", ")}</p>
        ${body}
      </article>`;
  }).join("");
}
