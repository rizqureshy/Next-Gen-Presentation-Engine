# Deck IR — the platform's content schema

Deck IR is a theme-agnostic JSON description of a presentation. Everything that
enters the platform (hand-written JSON today; ingested PowerPoint next) is
normalized to this shape, and every theme renders from it. The composer
(`composer.js`) turns IR into a zero-build HTML deck.

```
IR (deck.json) ──composer──▶ deck HTML ──engine + theme──▶ live deck
```

## Top level

```jsonc
{
  "meta": {
    "title": "…",             // <title> + fallback brand
    "description": "…",       // meta description (optional)
    "brand": "…",             // top-bar label (optional, falls back to title)
    "credit": "© 2026 …",     // per-slide footer credit (optional)
    "theme": "aurora",        // theme id: cosmos | aurora | …
    "loaderText": "…",        // loader caption (optional)
    "scrollHint": true        // show scroll hint on the cover (default true)
  },
  "slides": [ … ]
}
```

## Slides

```jsonc
{
  "role": "cover" | "content" | "closing",   // default: cover for slide 1, else content
  "layout": "center",        // optional; content slides are left-aligned by default
  "scene": "veil",           // optional theme scene; omitted → theme art-directs
                             // via sceneFor() hints (role, card count, flow, …)
  "cam": [0, 0.2, 15],       // optional camera nudge (themes may ignore)
  "notes": "…",              // speaker notes (carried, not rendered yet)
  "blocks": [ … ]
}
```

Scene vocabularies: **cosmos** `orb · core · core-center · clusters:N · split ·
ring · grid · stream · burst` — **aurora** `dawn · drift · veil · dusk · nova` —
**lasers** `gate · pillars:N · sweep · tunnel · weave · strike` —
**tiles** `wall · wave · columns:N · checker · spiral · cascade` —
**ink** `drop · bloom:N · wash · collide · torrent · eruption`.

## Blocks

Text fields support `{word}` → glowing key word and `**word**` → bold.

| Type | Fields | Renders as |
|---|---|---|
| `kicker` | `text` | eyebrow pill |
| `heading` | `text`, `level?` | `<h1>` on covers, `<h2>` elsewhere |
| `lede` | `text` | lead paragraph (`.sub` on covers) |
| `status` | `text` | orange status pill |
| `cards` | `columns?` (2–4), `items[]` | glass card grid |
| `flow` | `stages[]` | pipeline strip `A › B › C` |
| `moves` | `items[]` of `{lead, text}` | numbered list |
| `quote` | `text`, `attrib?` | big display quote |
| `image` | `src`, `alt?` | framed media |
| `note` | `text` | centered closing line |
| `cta` | `text` | call-to-action line |
| `presenter` | `name`, `role` | presenter chip (covers) |

Card items: `{ icon?, accent?, tag?, title, text }` — or `{ initials, title,
role, accent? }` for people cards. Icons: `star bolt check chart layers globe
shield growth users eye doc clock` (see `icons.js`). Accents: `blue indigo
purple teal gold pink`; omitted accents cycle automatically.

A leading run of `kicker`/`heading`/`lede`/`status` blocks is wrapped in the
`.lead` group automatically (standard slide header rhythm). Covers also get the
scroll hint appended unless `meta.scrollHint` is `false`.

## Planned (not yet implemented)

- `stats` block (big animated counters — Framer-style number tickers)
- per-slide `palette` overrides
- `media` ingested from PPTX with automatic asset copying
