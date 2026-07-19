#!/usr/bin/env node
/* ============================================================
   export-bundle.mjs — Deck IR → decomposed .zip bundle

     node platform/export/export-bundle.mjs <deck.json> <out.zip>

   Unzip anywhere and serve the folder (or push it to GitHub
   Pages / Netlify / any static host).
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeBundle } from "./bundle.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [, , irPath, outPath] = process.argv;
if (!irPath || !outPath) {
  console.error("usage: node export-bundle.mjs <deck.json> <out.zip>");
  process.exit(1);
}

const deck = JSON.parse(readFileSync(irPath, "utf8"));
const zip = await composeBundle(deck, {
  readFile: async (p) => readFileSync(join(ROOT, p), "utf8"),
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, zip);
console.log(`✓ bundle: ${deck.slides.length} slides (${deck.meta.theme} theme) → ${outPath} (${(zip.length / 1024 / 1024).toFixed(1)} MB)`);
