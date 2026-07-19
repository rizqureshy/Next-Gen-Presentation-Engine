# Authoring a deck on the Effects Platform

The platform is a **reusable presentation engine**: WebGL themes, animations,
design system, and slide controls are done. To make a new deck you write
**HTML content** (or [Deck IR JSON](platform/compose/schema.md)) — no engine
changes required.

> **Workflow:** branch a deck off `main`, e.g. `git checkout -b deck/<name>`,
> then edit `index.html` (or compose from JSON). Keep `platform/` untouched.

---

## 1. Anatomy of a slide

Every slide is one `<section class="slide">` inside `<main id="stage">`:

```html
<section class="slide content" data-slide="1" data-scene="clusters:3">
  <div class="slide-inner">
    <!-- your content -->
  </div>
  <div class="eq-credit">© 2026 Your Org</div>
</section>
```

- `data-slide` is just a label (ordering comes from DOM order).
- `data-scene` picks the theme's background artwork (see §3).
  `data-formation` still works as a legacy alias.
- **Omit `data-scene`** and the theme art-directs the slide from its content:
  covers get the hero scene, N cards get clusters, a pipeline gets a stream…
- Dots, counter, and prev/next **update automatically** from the slide count.

### Slide layout modifiers (on the `<section>`)
| Class | Effect |
|-------|--------|
| `content` | left-aligned content slide (default for body slides) |
| `center` | center everything (covers, closings, statements) |
| `cover` | larger title sizing for the opening slide |

---

## 2. Picking a theme

The deck's boot script chooses the theme — swap one import to reskin the
entire deck:

```html
<script type="module">
  import { mountDeck } from "./platform/engine/engine.js";
  import Cosmos from "./platform/themes/cosmos/cosmos.js";   // or aurora
  mountDeck(Cosmos);
</script>
```

Also link the theme's CSS next to the engine's:

```html
<link rel="stylesheet" href="platform/engine/deck.css" />
<link rel="stylesheet" href="platform/themes/cosmos/cosmos.css" />
```

---

## 3. Scenes (`data-scene`)

### Cosmos — particle formations

| Spec | Vibe / good for |
|------|-----------------|
| `orb` | hero sphere — covers, big statements |
| `core` | a tight, bright core offset right — "one thing" with text on the left |
| `core-center` | same core, centered |
| `clusters:N` | N constellations in a row — N parallel items (`clusters:3`) |
| `split` | two clouds — a duality, "does / doesn't" |
| `ring` | an orbital ring — cycles, access, time, flow |
| `grid` | a scanning lattice — data, coverage, "across the estate" |
| `stream` | a flowing horizontal band — pipelines, journeys |
| `burst` | a celebratory explosion — finales, thank-you |

### Aurora — silk moods

| Spec | Vibe / good for |
|------|-----------------|
| `dawn` | warm violet sunrise — covers, openings |
| `drift` | cool blue-teal silk — calm content slides |
| `veil` | a concentrated curtain of light — one big idea |
| `dusk` | deep and quiet — the serious beat |
| `nova` | bright pink-gold surge — finales |

Scenes **morph** between slides, so order creates motion. Pair the scene with
the slide's idea.

### Optional camera nudge
`data-cam="x,y,z"` overrides the camera for a slide (Cosmos; Aurora ignores
it). Higher `z` = further back.

---

## 4. Animation classes (add to elements inside a slide)

| Class | Use it on | What it does |
|-------|-----------|--------------|
| `reveal` | text, kickers, ledes, notes, CTAs | fades/rises in with a 3D tilt, staggered |
| `pop` | cards & panels | cascades in with depth + spring |

### Glowing key words
Wrap words in `gradient-text` to make them glow and radiate:

```html
<h2 class="reveal">A clear <span class="gradient-text">point</span> for this slide</h2>
```

---

## 5. Content components (copy-paste)

All components live in `platform/engine/deck.css` and use the shared glass theme.

**Kicker (eyebrow):**
```html
<span class="kicker reveal"><span class="dot"></span> Section label</span>
```

**Lead block (kicker + heading + lede):**
```html
<div class="lead">
  <span class="kicker reveal"><span class="dot"></span> Section</span>
  <h2 class="reveal">Heading with a <span class="gradient-text">key word</span></h2>
  <p class="lede reveal">One or two sentences of context.</p>
</div>
```

**Card grid** — `cards c2` / `c3` / `c4`. Per-card accent via inline `--ic`
(icon gradient) and `--ac` (glow):
```html
<div class="cards c3">
  <article class="card pop" style="--ic:linear-gradient(135deg,#2b88ff,#4a3fd0);--ac:#2b88ff;">
    <div class="ic"><svg viewBox="0 0 24 24"><path d="…"/></svg></div>
    <span class="tag">optional label</span>
    <h3>Card title</h3>
    <p>Supporting copy.</p>
  </article>
  …
</div>
```

**Pipeline / flow strip:**
```html
<div class="flow reveal">
  <span class="stage">Build</span><span class="arrow">›</span>
  <span class="stage">Validate</span><span class="arrow">›</span>
  <span class="stage">Ship</span>
</div>
```

**Numbered list:**
```html
<div class="moves">
  <div class="move pop"><span class="n">1</span><p><b>Lead-in.</b> Detail.</p></div>
  …
</div>
```

**Big quote:**
```html
<div class="quote">
  <blockquote class="reveal">The line you want them to remember.</blockquote>
  <p class="attrib reveal">— Who said it</p>
</div>
```

**People / owners** (card with initials avatar):
```html
<article class="card pop" style="--ac:#2b88ff;">
  <div class="ava" style="--ic:linear-gradient(135deg,#2b88ff,#4a3fd0);">RA</div>
  <div class="who">Full Name</div>
  <p class="role">Role line</p>
</article>
```

**Status pill:** `<span class="status reveal">Status · …</span>`
**Note line:** `<p class="note reveal">…</p>`  ·  **CTA:** `<p class="cta reveal">…</p>`
**Presenter (cover):** `<div class="presenter reveal"><span class="dot2"></span> <span><b>Name</b> · Team</span></div>`

Icons are inline `<svg viewBox="0 0 24 24"><path d="…"/></svg>` with `fill:#fff`
(handled by `.card .ic svg`) — a starter set lives in
`platform/compose/icons.js`.

### Accent palette
`--blue #2b88ff` · `--indigo #6b5bff` · `--purple #9b4dff` · `--teal #18c8b6` ·
`--gold #ffcf45`. Keep colour use restrained — a couple of accents per slide.

---

## 6. Authoring in JSON (Deck IR)

Instead of HTML you can describe the deck as JSON and let the composer build
the page — this is the same path PowerPoint ingestion will use:

```bash
node platform/compose/build-deck.mjs my-deck.json decks/my-deck/index.html
```

Full schema + block reference: **[platform/compose/schema.md](platform/compose/schema.md)**.
The Aurora demo (`decks/aurora-demo/`) is generated from
`platform/compose/example-deck.json` — use it as a starting point.

---

## 7. Branding (per deck)

In your deck HTML (or Deck IR `meta`):
- `<title>…</title>`
- brand label in the top bar: `<div class="logo"><span class="spark"></span> Your Title</div>`
- footer credit: each slide's `<div class="eq-credit">© 2026 Your Org</div>`
- the loader caption: `.lbl` text

Theme colours and fonts live in `:root` at the top of `platform/engine/deck.css`.

---

## 8. Run & deploy

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
Must be served over `http(s)://` (ES module import maps don't work from
`file://`). No build step, no network needed at runtime — Three.js + GSAP are
vendored in `assets/vendor/`.

Deploy: push the deck branch and enable **GitHub Pages → Deploy from branch (root)**.

---

## 9. Where things live

```
index.html                   # the Cosmos template deck — edit for content
decks/<name>/index.html      # additional decks (hand-written or composed)
platform/engine/deck.css     # design system + components + chrome
platform/engine/engine.js    # slide controller + navigation   (don't edit for content)
platform/engine/theme.js     # Theme contract                  (don't edit for content)
platform/themes/<id>/        # one folder per theme: <id>.js + <id>.css
platform/compose/            # Deck IR schema + composer + CLI
assets/vendor/               # three.js + gsap
```

Adding a brand-new theme? Extend `ThemeBase` (`platform/engine/theme.js`),
implement `_applyScene()` + a scene vocabulary + `sceneFor()` hints, ship
`<id>.js` + `<id>.css` in `platform/themes/<id>/`, and reference it from a
deck's boot script. Cosmos (`cosmos.js`) is the reference implementation.
