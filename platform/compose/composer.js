/* ============================================================
   composer.js — Deck IR → deployable deck HTML.

   Pure ES module with no dependencies; runs in Node (the
   build-deck.mjs CLI) and in the browser (the future Studio).
   See schema.md for the Deck IR format.

   composeDeck(deck, { base }) returns a complete HTML document.
   `base` is the relative path from the output HTML back to the
   repo root ("../.." for decks/<name>/index.html, "." for a
   deck at the root).

   Text conventions inside IR strings:
     {word}      → glowing key word  (<span class="gradient-text">)
     **word**    → bold              (<b>)
   ============================================================ */

import { iconSvg } from "./icons.js";

/* per-card accent presets (icon gradient + glow color) */
const ACCENTS = {
  blue:   { ic: "linear-gradient(135deg,#2b88ff,#4a3fd0)", ac: "#2b88ff" },
  indigo: { ic: "linear-gradient(135deg,#7c6bff,#4a3fd0)", ac: "#8b7bff" },
  purple: { ic: "linear-gradient(135deg,#9b4dff,#6b5bff)", ac: "#9b4dff" },
  teal:   { ic: "linear-gradient(135deg,#18c8b6,#2b88ff)", ac: "#18c8b6" },
  gold:   { ic: "linear-gradient(135deg,#ffcf45,#ff8a3d)", ac: "#ffcf45" },
  pink:   { ic: "linear-gradient(135deg,#ff4db8,#9b4dff)", ac: "#ff4db8" },
};
const ACCENT_ORDER = Object.keys(ACCENTS);

const esc = (s) => String(s)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

/* {glow} + **bold** aware text renderer */
function rich(text) {
  return String(text ?? "")
    .split(/\{([^}]+)\}/g)
    .map((part, i) => {
      const safe = esc(part).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
      return i % 2 ? `<span class="gradient-text">${safe}</span>` : safe;
    })
    .join("");
}

function accentFor(item, index) {
  return ACCENTS[item.accent] || ACCENTS[ACCENT_ORDER[index % ACCENT_ORDER.length]];
}

/* ---------------- block renderers ---------------- */
const BLOCKS = {
  kicker: (b) =>
    `<span class="kicker reveal"><span class="dot"></span> ${rich(b.text)}</span>`,

  heading: (b, ctx) => {
    const lv = b.level || (ctx.role === "cover" ? 1 : 2);
    return `<h${lv} class="reveal">${rich(b.text)}</h${lv}>`;
  },

  lede: (b, ctx) =>
    ctx.role === "cover"
      ? `<p class="sub reveal">${rich(b.text)}</p>`
      : `<p class="lede reveal">${rich(b.text)}</p>`,

  status: (b) => `<span class="status reveal">${rich(b.text)}</span>`,

  cards: (b) => {
    const cols = Math.min(Math.max(b.columns || b.items.length, 2), 4);
    const cards = b.items.map((item, i) => {
      const a = accentFor(item, i);
      const media = item.initials
        ? `<div class="ava" style="--ic:${a.ic};">${esc(item.initials)}</div>`
        : `<div class="ic">${iconSvg(item.icon)}</div>`;
      const tag = item.tag ? `<span class="tag">${rich(item.tag)}</span>` : "";
      const body = item.role
        ? `<div class="who">${rich(item.title)}</div><p class="role">${rich(item.role)}</p>`
        : `<h3>${rich(item.title)}</h3><p>${rich(item.text)}</p>`;
      return `<article class="card pop" style="--ic:${a.ic};--ac:${a.ac};">${media}${tag}${body}</article>`;
    }).join("\n          ");
    return `<div class="cards c${cols}">\n          ${cards}\n        </div>`;
  },

  flow: (b) => {
    const inner = b.stages
      .map((s) => `<span class="stage">${rich(s)}</span>`)
      .join(`<span class="arrow">›</span>`);
    return `<div class="flow reveal">${inner}</div>`;
  },

  moves: (b) => {
    const rows = b.items.map((m, i) =>
      `<div class="move pop"><span class="n">${i + 1}</span><p><b>${rich(m.lead)}</b> ${rich(m.text)}</p></div>`
    ).join("\n          ");
    return `<div class="moves">\n          ${rows}\n        </div>`;
  },

  quote: (b) =>
    `<div class="quote"><blockquote class="reveal">${rich(b.text)}</blockquote>` +
    `<p class="attrib reveal">${rich(b.attrib || "")}</p></div>`,

  image: (b) =>
    `<figure class="media pop"><img src="${esc(b.src)}" alt="${esc(b.alt || "")}"/></figure>`,

  note: (b) => `<p class="note reveal">${rich(b.text)}</p>`,
  cta:  (b) => `<p class="cta reveal">${rich(b.text)}</p>`,

  presenter: (b) =>
    `<div class="presenter reveal"><span class="dot2"></span> ` +
    `<span><b>${rich(b.name)}</b> · ${rich(b.role)}</span></div>`,
};

/* ---------------- slide + document ---------------- */
function renderSlide(slide, i, deck) {
  const role = slide.role || (i === 0 ? "cover" : "content");
  const classes = ["slide"];
  if (role === "cover") classes.push("cover", "center");
  else {
    classes.push("content");
    if (role === "closing" || slide.layout === "center") classes.push("center");
  }

  const attrs = [`class="${classes.join(" ")}"`, `data-slide="${i}"`];
  if (slide.scene) attrs.push(`data-scene="${esc(slide.scene)}"`);
  if (slide.cam) attrs.push(`data-cam="${slide.cam.join(",")}"`);

  const ctx = { role, deck };
  // consecutive leading kicker/heading/lede/status blocks form the .lead group
  const LEAD_TYPES = new Set(["kicker", "heading", "lede", "status"]);
  let split = 0;
  while (split < slide.blocks.length && LEAD_TYPES.has(slide.blocks[split].type)) split++;

  const render = (b) => {
    const fn = BLOCKS[b.type];
    if (!fn) throw new Error(`Unknown block type "${b.type}" (slide ${i + 1})`);
    return fn(b, ctx);
  };

  const leadBlocks = slide.blocks.slice(0, split).map(render).join("\n          ");
  const bodyBlocks = slide.blocks.slice(split).map(render).join("\n        ");
  const lead = leadBlocks && role !== "cover"
    ? `<div class="lead">\n          ${leadBlocks}\n        </div>`
    : leadBlocks;
  const hint = role === "cover" && deck.meta.scrollHint !== false
    ? `\n        <div class="scroll-hint reveal"><span class="mouse"></span> scroll or use arrows</div>`
    : "";

  return `    <section ${attrs.join(" ")}>
      <div class="slide-inner">
        ${[lead, bodyBlocks].filter(Boolean).join("\n        ")}${hint}
      </div>
      <div class="eq-credit">${esc(deck.meta.credit || "")}</div>
    </section>`;
}

export function renderSlides(deck) {
  return deck.slides.map((s, i) => renderSlide(s, i, deck)).join("\n\n");
}

/* engine chrome — loader, background layers, progress, brand bar, nav.
   Shared by composeDeck and the exporters so the markup never drifts. */
export function renderChrome(deck) {
  const m = deck.meta;
  return `  <div id="loader">
    <div class="orb"></div>
    <div class="lbl">${esc(m.loaderText || "Spinning up the universe…")}</div>
  </div>

  <canvas id="bg-canvas"></canvas>
  <div class="wash"></div>
  <div class="vignette"></div>

  <div class="progress"><div class="bar" id="bar"></div></div>
  <header class="chrome brandbar">
    <div class="logo"><span class="spark"></span> ${esc(m.brand || m.title || "Deck")}</div>
    <div class="count"><b id="c-now">01</b> / <span id="c-tot">${String(deck.slides.length).padStart(2, "0")}</span></div>
  </header>

  <button class="nav-btn prev" id="prev" aria-label="Previous slide">
    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
  </button>
  <button class="nav-btn next" id="next" aria-label="Next slide">
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
  </button>

  <nav class="chrome dots" id="dots" aria-label="Slide navigation"></nav>`;
}

/* shared <head> boilerplate: favicon + async font loading */
export const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%232b88ff'/%3E%3Cstop offset='1' stop-color='%239b4dff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='24' height='24' rx='6' fill='url(%23g)'/%3E%3C/svg%3E" />`;
export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" /></noscript>`;

export function composeDeck(deck, opts = {}) {
  const base = opts.base ?? "..";
  const theme = deck.meta.theme || "cosmos";
  const m = deck.meta;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover" />
  <title>${esc(m.title || "Untitled deck")}</title>
  <meta name="description" content="${esc(m.description || "")}" />
  ${FAVICON}

  <!-- Fonts loaded async so a slow/blocked CDN never render-blocks the deck -->
  ${FONT_LINKS}

  <link rel="stylesheet" href="${base}/platform/engine/deck.css" />
  <link rel="stylesheet" href="${base}/platform/themes/${theme}/${theme}.css" />

  <!-- engine deps, vendored locally (offline-friendly) -->
  <script src="${base}/assets/vendor/gsap.min.js"></script>
  <script type="importmap">
  {
    "imports": {
      "three": "${base}/assets/vendor/three/three.module.js",
      "three/addons/": "${base}/assets/vendor/three/addons/"
    }
  }
  </script>
</head>
<body>

${renderChrome(deck)}

  <main id="stage">

${renderSlides(deck)}

  </main>

  <script type="module">
    import { mountDeck } from "${base}/platform/engine/engine.js";
    import Theme from "${base}/platform/themes/${theme}/${theme}.js";
    mountDeck(Theme);
  </script>
</body>
</html>
`;
}
