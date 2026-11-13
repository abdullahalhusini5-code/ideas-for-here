/* Light and dark, in one small file. No dependencies, nothing fetched.
 *
 * Loaded from <head> without `defer`, so a stored choice is applied before the
 * first paint and the page never flashes the wrong theme.
 *
 * The chosen theme lives in localStorage under "ideas-theme". When nothing is
 * stored the page follows the operating system through CSS alone, and choosing
 * the theme the system is already using clears the stored value again instead
 * of pinning it.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ideas-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  /* The browser bar colour is the only thing CSS cannot switch, because the
     meta tag has no media query of its own here. */
  var CHROME = { light: "#f7f3ea", dark: "#15140f" };

  function stored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (err) {
      return null; /* storage can be blocked; the system setting still works */
    }
  }

  function remember(theme) {
    try {
      if (theme === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* nothing to do: the theme still applies to this page view */
    }
  }

  function system() {
    return media && media.matches ? "dark" : "light";
  }

  function current() {
    var set = root.getAttribute("data-theme");
    return set === "light" || set === "dark" ? set : system();
  }

  function paint(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", CHROME[theme]);

    var button = document.getElementById("theme-toggle");
    if (!button) return;
    button.hidden = false;
    button.setAttribute("aria-pressed", String(theme === "dark"));
  }

  function choose(theme) {
    if (theme === system()) {
      root.removeAttribute("data-theme");
      remember(null);
    } else {
      root.setAttribute("data-theme", theme);
      remember(theme);
    }
    paint(theme);
    /* The canvas on brain.html reads the tokens directly, so tell it. */
    document.dispatchEvent(new CustomEvent("ideas:theme", { detail: { theme: theme } }));
  }

  /* Before first paint: honour the stored choice only. */
  var saved = stored();
  if (saved) root.setAttribute("data-theme", saved);

  function ready() {
    var button = document.getElementById("theme-toggle");
    if (button) {
      button.addEventListener("click", function () {
        choose(current() === "dark" ? "light" : "dark");
      });
    }
    paint(current());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  /* If the system flips while the page is open and the visitor never chose,
     the button label follows. */
  if (media) {
    var onChange = function () { if (!root.getAttribute("data-theme")) paint(current()); };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }
})();
