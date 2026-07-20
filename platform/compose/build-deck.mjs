#!/usr/bin/env node
/* ============================================================
   build-deck.mjs — compose a deck from Deck IR on the CLI.

     node platform/compose/build-deck.mjs <deck.json> <out.html> [base]

   [base] is the relative path from out.html back to the repo
   root (default "../.." — right for decks/<name>/index.html).
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { composeDeck } from "./composer.js";

const [, , irPath, outPath, base = "../.."] = process.argv;
if (!irPath || !outPath) {
  console.error("usage: node build-deck.mjs <deck.json> <out.html> [base]");
  process.exit(1);
}

const deck = JSON.parse(readFileSync(irPath, "utf8"));
const html = composeDeck(deck, { base });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`✓ composed ${deck.slides.length} slides (${deck.meta.theme || "cosmos"} theme) → ${outPath}`);
