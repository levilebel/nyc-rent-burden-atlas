// Section F — Research log, driven entirely by content/research.json.
export function init({ registry }) {
  const src = Object.fromEntries(registry.sources.map((s) => [s.id, s]));
  const cards = registry.modules.map((m) => `
    <article class="module">
      <div><div class="status ${m.status === "completed" ? "" : "planned"}">${m.status}</div><div class="id">${m.id.toUpperCase()}</div></div>
      <div>
        <h3>${m.title}</h3>
        <p><strong>Scope:</strong> ${m.scope}</p>
        <p>${m.notes}</p>
        <p><strong>How it is used here:</strong> ${m.integration}</p>
        <p><strong>Sources:</strong> ${m.sources.map((id) => src[id]?.table || src[id]?.name || id).join(" · ")}</p>
      </div>
    </article>`);
  cards.push(`
    <article class="module placeholder">
      <div><div class="status planned">next</div><div class="id">—</div></div>
      <div>
        <h3>Future assignments</h3>
        <p>No further assignment files exist yet (the project's <em>Future Projects</em> folder was empty at the last build).
          When Homework 5, Homework 6 or other work is completed, its files will be inspected, validated and added here as a new module. Existing modules will stay as they are.</p>
      </div>
    </article>`);
  document.getElementById("research-content").innerHTML = cards.join("");
}
