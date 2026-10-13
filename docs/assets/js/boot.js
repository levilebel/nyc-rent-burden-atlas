// Entry point. The charts need D3 (loaded from jsDelivr, with unpkg as a fallback in index.html).
// If neither CDN is reachable, show a clear message instead of failing silently.
if (window.d3) {
  import("./app.js");
} else {
  const main = document.getElementById("main");
  main.insertAdjacentHTML("afterbegin",
    `<div class="wrap" style="padding:24px"><div class="card load-error" role="alert"><strong>Charts could not be loaded.</strong>
     The D3 visualisation library could not be downloaded from cdn.jsdelivr.net or unpkg.com (offline, blocked network, or CDN outage).
     The text on this page is still available; please reload when the connection is restored.</div></div>`);
  document.querySelectorAll(".chart, .map").forEach((c) => {
    c.innerHTML = `<p class="empty-state">Chart unavailable — the D3 library did not load.</p>`;
  });
}
