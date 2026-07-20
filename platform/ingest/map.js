/* ============================================================
   map.js — semantic mapper: raw PPTX structure → Deck IR.

   The platform deliberately does NOT replicate PowerPoint
   layout. It re-expresses the content in the platform's design
   system, with art direction chosen from the content's shape:

     2–4 short bullets   → glass cards
     5–8 bullets         → numbered moves
     1 short paragraph   → lede
     longer prose        → lede + note
     images              → framed media
     "thank you" slide   → closing role (finale scene)

   Scenes are left unset so each theme's sceneFor() art-directs
   from the same hints at runtime.
   ============================================================ */

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "with", "your",
  "our", "this", "that", "is", "are", "on", "at", "we", "it", "as", "by",
  "from", "into", "you", "be", "will", "was", "were", "what", "how", "why",
]);
const CLOSING_RE = /thank|question|q\s*&\s*a|merci|danke|gracias|the end|let'?s talk/i;
const ICON_CYCLE = ["bolt", "layers", "check", "chart", "globe", "shield", "growth", "users", "eye", "doc", "clock", "star"];

/** wrap the most substantial word in {…} so it glows */
function emphasize(text) {
  if (!text || text.includes("{")) return text;
  const words = text.split(/\s+/);
  let best = "", bestLen = 4;                 // only words ≥5 chars qualify
  for (const w of words) {
    const clean = w.replace(/[^\p{L}\p{N}'-]/gu, "");
    if (clean.length > bestLen && !STOP.has(clean.toLowerCase())) {
      best = w; bestLen = clean.length;
    }
  }
  if (!best) return text;
  const clean = best.replace(/[^\p{L}\p{N}'-]/gu, "");
  return text.replace(best, best.replace(clean, `{${clean}}`));
}

/** split a bullet into a short lead + remainder at the first separator */
function splitLead(text, maxLead = 42) {
  const m = text.match(/^(.{2,60}?)(?:\s*[:–—]\s+|\.\s+)(.+)$/);
  if (m && m[1].length <= maxLead) return [m[1], m[2]];
  return null;
}

/** fold sub-bullets (lvl>0) into their parent item's text */
function topLevelItems(paras) {
  const items = [];
  for (const p of paras) {
    if (p.lvl === 0 || items.length === 0) items.push({ ...p });
    else items[items.length - 1].text += ` — ${p.text}`;
  }
  return items;
}

/* long sentences are prose even when they sit in a bullet placeholder */
function proseLike(p) {
  return p.text.length > 90 || (/[.!?]$/.test(p.text) && p.text.length > 60);
}

function isBulletList(items) {
  if (items.length < 2 || items.some((p) => p.text.length > 200)) return false;
  return items.filter(proseLike).length < items.length / 2;
}

function bodyBlocks(bodies) {
  const blocks = [];
  for (const paras of bodies) {
    const items = topLevelItems(paras);

    if (isBulletList(items) && items.length <= 4 && items.every((p) => p.text.length <= 140)) {
      // short parallel bullets → cards
      blocks.push({
        type: "cards",
        columns: Math.min(items.length, 4),
        items: items.map((p, i) => {
          const split = splitLead(p.text);
          return {
            icon: ICON_CYCLE[i % ICON_CYCLE.length],
            title: split ? split[0] : p.text.split(/\s+/).slice(0, 4).join(" "),
            text: split ? split[1] : (p.text.split(/\s+/).length > 4 ? p.text : ""),
          };
        }),
      });
    } else if (isBulletList(items) && items.length <= 8) {
      // longer list → numbered moves
      blocks.push({
        type: "moves",
        items: items.map((p) => {
          const split = splitLead(p.text);
          return split
            ? { lead: split[0].replace(/[.:]$/, "") + ".", text: split[1] }
            : { lead: "", text: p.text };
        }),
      });
    } else if (isBulletList(items)) {
      // very long list → moves for the first 8, note for the rest
      blocks.push({
        type: "moves",
        items: items.slice(0, 8).map((p) => ({ lead: "", text: p.text })),
      });
      blocks.push({ type: "note", text: `…and ${items.length - 8} more.` });
    } else {
      // prose: first paragraph as lede, remainder as a note
      if (items[0]) blocks.push({ type: "lede", text: items[0].text });
      if (items.length > 1) {
        blocks.push({ type: "note", text: items.slice(1).map((p) => p.text).join(" ") });
      }
    }
  }
  return blocks;
}

/**
 * @param {object} raw   output of extractPptx()
 * @param {object} opts  { theme, brand, credit, kicker, emphasize }
 * @returns Deck IR (see platform/compose/schema.md)
 */
export function mapToDeckIR(raw, opts = {}) {
  const glow = opts.emphasize !== false;
  const deckTitle = raw.title || raw.slides[0]?.title || "Imported deck";
  const slides = [];
  const src = raw.slides.filter((s) => s.title || s.subtitle || s.bodies.length || s.images.length);

  src.forEach((s, i) => {
    const isCover = i === 0;
    const isClosing = !isCover && i === src.length - 1 && CLOSING_RE.test(s.title || "");
    const role = isCover ? "cover" : isClosing ? "closing" : "content";
    const blocks = [];

    if (opts.kicker !== false) {
      blocks.push({
        type: "kicker",
        text: isCover ? (opts.brand || deckTitle) : isClosing ? "Wrap-up" : `Slide ${String(i + 1).padStart(2, "0")}`,
      });
    }
    if (s.title) {
      blocks.push({ type: "heading", text: glow ? emphasize(s.title) : s.title });
    }
    if (s.subtitle) blocks.push({ type: "lede", text: s.subtitle });

    if (isClosing) {
      const extra = s.bodies.flat().map((p) => p.text).join(" ");
      if (extra) blocks.push({ type: "cta", text: glow ? emphasize(extra) : extra });
    } else {
      blocks.push(...bodyBlocks(s.bodies));
    }
    for (const img of s.images) blocks.push({ type: "image", src: img });

    const slide = { role, blocks };
    if (role === "content" && !s.bodies.length && s.images.length) slide.layout = "center";
    if (s.notes) slide.notes = s.notes;
    slides.push(slide);
  });

  return {
    meta: {
      title: deckTitle,
      brand: opts.brand || deckTitle,
      credit: opts.credit || "",
      theme: opts.theme || "aurora",
      description: `Imported from PowerPoint — ${src.length} slides.`,
    },
    slides,
  };
}
