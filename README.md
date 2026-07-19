# Effects Platform — themeable 3D presentation engine

A presentation platform where the deck's background is a **live WebGL world**.
One shared engine drives navigation, Framer-style reveals, and transition
choreography; pluggable **themes** render the world behind the slides and morph
it on every slide change. Zero build, zero runtime network — Three.js + GSAP
are vendored, and decks deploy as-is to GitHub Pages.

| Cosmos (particles) | Aurora (silk gradients) |
|---|---|
| ![Cosmos](docs/preview/01-cover.png) | ![Aurora](docs/preview/04-aurora.png) |

## Themes

| Theme | Look | Scene vocabulary | Status |
|---|---|---|---|
| **Cosmos** | ~13k GPU particles morphing between formations, whirlwind transitions | `orb · core · core-center · clusters:N · split · ring · grid · stream · burst` | ✅ shipped |
| **Aurora** | domain-warped silk-gradient skies that drift and surge | `dawn · drift · veil · dusk · nova` | ✅ shipped |
| Neon Lasers | beams that draw the slide, selective bloom | — | 🔜 roadmap |
| Liquid Ink | real-time fluid sim, ink splats bleeding like wet paper | — | 🔜 roadmap |
| Kinetic Tiles | an instanced 3D tile wall that ripples and re-mosaics | — | 🔜 roadmap |

**Demos:** root `index.html` is the Cosmos template deck ·
[`decks/aurora-demo/`](decks/aurora-demo/) is the Aurora showcase (generated
from Deck IR by the composer).

## Make a deck

```bash
git checkout -b deck/<your-deck-name>
python3 -m http.server 8000     # preview at http://localhost:8000
```

**Author in HTML** — duplicate a slide `<section>`, pick a scene, write content
(full guide: **[AUTHORING.md](AUTHORING.md)**):

```html
<section class="slide content" data-scene="clusters:3">
  <div class="slide-inner"> … your content … </div>
</section>
```

Omit `data-scene` and the theme art-directs the slide from its content
(cover → hero scene, N cards → clusters, pipeline → stream, …).

**Or author in JSON (Deck IR)** and let the composer build the page
(schema: **[platform/compose/schema.md](platform/compose/schema.md)**):

```bash
node platform/compose/build-deck.mjs my-deck.json decks/my-deck/index.html
```

Swap the theme by changing one line (`"theme": "aurora"` in IR, or the theme
import in HTML). Dots, counter, and navigation update automatically.

## What the engine gives every theme

- **Choreographed transitions** — the theme surges mid-morph while the DOM
  dissolves and swaps at the obscured peak; content is always crisp DOM
- **Framer-style flows** — depth-based text reveals, card cascades, staggers
- **Full controls** — arrows, ↑/↓, Space, Page keys, Home/End, wheel, touch
  swipe, on-screen arrows, dot navigator, progress bar, mouse parallax
- **Glass design system** — cards, kickers, flows, quotes, numbered moves,
  glowing key words, focal scrim for legibility
- **Accessibility & perf tiers** — `prefers-reduced-motion` lowers particle
  counts and disables surges

## Project layout

```
index.html                    # Cosmos template deck (GitHub Pages entry)
decks/aurora-demo/            # Aurora showcase deck (composer output)
platform/
  engine/
    engine.js                 # slide controller + navigation + GSAP flows
    theme.js                  # the Theme contract (scenes, sceneFor, choreography)
    deck.css                  # shared glass design system + chrome
  themes/
    cosmos/                   # particle field theme  (cosmos.js + cosmos.css)
    aurora/                   # silk gradient theme   (aurora.js + aurora.css)
  compose/
    schema.md                 # Deck IR — the content schema
    composer.js               # Deck IR -> deck HTML (Node + browser)
    build-deck.mjs            # CLI: node build-deck.mjs <ir.json> <out.html>
    example-deck.json         # the Aurora demo's source IR
assets/vendor/                # three.js r160 + gsap 3.12 (local, offline-friendly)
docs/preview/                 # screenshots
```

## Roadmap

- [x] **Phase 0** — engine/theme split, Theme contract, Deck IR + composer
- [x] **Phase 1a** — Aurora theme (proves the plug-in model)
- [ ] **Phase 1b** — Neon Lasers, Liquid Ink, Kinetic Tiles themes
- [ ] **Phase 2** — PowerPoint ingestion (client-side PPTX → Deck IR) + Studio UI
- [ ] **Phase 3** — exporters: single-file HTML, bundle zip, one-click GitHub Pages
- [ ] **Phase 4** — AI art direction, kinetic typography, presenter mode

## Tech

- **[Three.js](https://threejs.org/) r160** — WebGL renderers per theme
- **[GSAP](https://gsap.com/) 3.12** — the single motion driver (uniforms, camera, DOM)
- Vanilla JS/CSS ES modules, no framework, no bundler
