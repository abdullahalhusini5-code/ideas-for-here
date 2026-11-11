/* Ideas for Here — catalog loader.
 *
 * The catalog itself lives in ideas.json so it can be edited, validated and
 * served by the MCP server without touching the page. On the public static
 * site this is a single same-origin fetch of ideas.json. When the local
 * server (node server.mjs) is running it appends CATALOG_API to this file,
 * so /api/ideas is preferred and ideas added or changed through MCP appear
 * on the next reload without a deploy. The static file never asks for an
 * endpoint that a static host would answer with 404, so the console stays
 * clean on GitHub Pages.
 *
 * The page stays readable if the fetch fails; app.js shows a short note
 * instead of an empty grid.
 */
window.CATALOG = null;
window.CATALOG_ERROR = null;
window.catalogReady = (async () => {
  const sources = window.CATALOG_API
    ? [window.CATALOG_API, "ideas.json"]
    : ["ideas.json"];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !Array.isArray(data.ideas) || !Array.isArray(data.areas)) {
        throw new Error("catalog shape is wrong");
      }
      window.CATALOG = data;
      return data;
    } catch (err) {
      /* try the next source */
    }
  }
  window.CATALOG_ERROR = "The catalog could not be loaded. Serve this folder over HTTP (for example python -m http.server) and reload.";
  return null;
})();
