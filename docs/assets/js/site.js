// Site chrome shared by every page (index.html, about.html): theme toggle and navigation.
// No D3 dependency, so pages without charts can use it.

const THEME_KEY = "atlas-theme";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const themeNow = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

// ---------- theme ----------
// The inline script in each page's <head> sets data-theme before first paint. Here: toggle,
// persistence (localStorage), following the OS while no choice is saved, and an optional redraw hook.
function syncToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  // Accessible name describes the action the button will perform (not a pressed state).
  const action = themeNow() === "dark" ? "Switch to light mode" : "Switch to dark mode";
  btn.setAttribute("aria-label", action);
  btn.title = action;
}

export function initTheme({ onChange } = {}) {
  const setTheme = (theme, persist) => {
    const root = document.documentElement;
    if (theme === themeNow()) return;
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
    syncToggle();
    if (onChange) onChange(theme); // e.g. redraw charts; no data is recomputed
  };
  syncToggle();
  document.getElementById("theme-toggle")?.addEventListener("click", () => setTheme(themeNow() === "dark" ? "light" : "dark", true));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (document.documentElement.getAttribute("data-theme-source") !== "user") setTheme(e.matches ? "dark" : "light", false);
  });
}

// ---------- navigation ----------
// Mobile menu toggle + scroll-spy. A nav link can cover several sections:
// <a href="#boroughs" data-sections="boroughs zips">Rent Burden</a>
export function initNav() {
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
  const owner = new Map(); // section id -> nav link
  links.forEach((a) => {
    const href = a.getAttribute("href");
    const ids = a.dataset.sections ? a.dataset.sections.split(/\s+/) : href.startsWith("#") ? [href.slice(1)] : [];
    ids.forEach((id) => owner.set(id, a));
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const active = owner.get(en.target.id);
      links.forEach((a) => {
        a.classList.toggle("active", a === active);
        if (a === active) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  // Observe every section, so sections without a nav item (methodology, research log) clear the highlight.
  document.querySelectorAll("main section[id]").forEach((t) => io.observe(t));
}
