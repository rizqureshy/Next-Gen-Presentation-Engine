/* ============================================================
   singlefile.js — Deck IR → ONE self-contained .html file.

   Everything a deck needs rides inside the file:
     · deck.css + theme css        → inline <style>
     · GSAP                        → inline <script>
     · three.module.js             → import-map entry pointing at a
                                     data: URI (keeps Three in its own
                                     module scope — no name collisions)
     · engine + theme modules      → concatenated into one inline
                                     <script type="module">

   The concatenation is a deliberately tiny "bundler" that only
   understands OUR module graph: it strips import/export keywords
   and rewrites `import { X } from "three"` to destructuring from
   the THREE namespace. Images/fonts: IR images are data URIs
   already; webfonts stay as async CDN links with system fallback,
   so the file also works fully offline.

   Isomorphic: pass { readFile } (Node fs or browser fetch).
   ============================================================ */

import { renderSlides, renderChrome, FAVICON, FONT_LINKS } from "../compose/composer.js";

/* per-theme vendor addons that must ride along */
const THEME_ADDONS = {
  tiles: ["assets/vendor/three/addons/geometries/RoundedBoxGeometry.js"],
};

const esc = (s) => String(s ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

/* prevent an inline script from terminating its own <script> tag */
const safeInline = (js) => js.replace(/<\/script/gi, "<\\/script");

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* strip module syntax from one of OUR first-party modules */
function stripModule(src) {
  return src
    .replace(/^import\s*\*\s*as\s+THREE\s+from\s*["'][^"']+["'];?\s*$/gm, "")
    .replace(/^import\s*\{([^}]+)\}\s*from\s*["']three["'];?\s*$/gm, "const {$1} = THREE;")
    .replace(/^import\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?\s*$/gm, "")
    .replace(/^import\s+\w+\s+from\s*["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+default\s+class\s+/m, "class ")
    .replace(/^export\s+class\s+/gm, "class ")
    .replace(/^export\s+(async\s+)?function\s+/gm, "$1function ")
    .replace(/^export\s+const\s+/gm, "const ");
}

function themeClassName(src) {
  const m = src.match(/export\s+default\s+class\s+(\w+)/);
  if (!m) throw new Error("theme module has no `export default class`");
  return m[1];
}

/**
 * @param {object} deck      Deck IR
 * @param {object} opts      { readFile(path) → Promise<string> } — path is repo-root-relative
 * @returns {Promise<string>} a complete standalone HTML document
 */
export async function composeSingleFile(deck, { readFile }) {
  const theme = deck.meta.theme || "cosmos";
  const m = deck.meta;

  const [deckCss, themeCss, gsapSrc, threeSrc, themeBaseSrc, engineSrc, themeSrc] =
    await Promise.all([
      readFile("platform/engine/deck.css"),
      readFile(`platform/themes/${theme}/${theme}.css`),
      readFile("assets/vendor/gsap.min.js"),
      readFile("assets/vendor/three/three.module.js"),
      readFile("platform/engine/theme.js"),
      readFile("platform/engine/engine.js"),
      readFile(`platform/themes/${theme}/${theme}.js`),
    ]);
  const addonSrcs = await Promise.all((THEME_ADDONS[theme] || []).map(readFile));

  const moduleSrc = [
    `import * as THREE from "three";`,
    stripModule(themeBaseSrc),
    ...addonSrcs.map(stripModule),
    stripModule(themeSrc),
    stripModule(engineSrc),
    `mountDeck(${themeClassName(themeSrc)});`,
  ].join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover" />
  <title>${esc(m.title || "Untitled deck")}</title>
  <meta name="description" content="${esc(m.description || "")}" />
  <meta name="generator" content="Effects Platform — single-file export" />
  ${FAVICON}

  <!-- webfonts are the only network fetch; system fonts cover offline -->
  ${FONT_LINKS}

  <style>
${deckCss}
  </style>
  <style>
${themeCss}
  </style>

  <script>
${safeInline(gsapSrc)}
  </script>
  <script type="importmap">
  { "imports": { "three": "data:text/javascript;base64,${toBase64(threeSrc)}" } }
  </script>
</head>
<body>

${renderChrome(deck)}

  <main id="stage">

${renderSlides(deck)}

  </main>

  <script type="module">
${safeInline(moduleSrc)}
  </script>
</body>
</html>
`;
}
