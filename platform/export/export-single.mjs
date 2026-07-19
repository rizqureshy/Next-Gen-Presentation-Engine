#!/usr/bin/env node
/* ============================================================
   export-single.mjs — Deck IR → one self-contained .html

     node platform/export/export-single.mjs <deck.json> <out.html>

   The result opens anywhere — double-click it, email it, drop
   it on any static host. No folder, no build, no network
   (webfonts degrade gracefully to system fonts).
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeSingleFile } from "./singlefile.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [, , irPath, outPath] = process.argv;
if (!irPath || !outPath) {
  console.error("usage: node export-single.mjs <deck.json> <out.html>");
  process.exit(1);
}

const deck = JSON.parse(readFileSync(irPath, "utf8"));
const html = await composeSingleFile(deck, {
  readFile: async (p) => readFileSync(join(ROOT, p), "utf8"),
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
const mb = (html.length / 1024 / 1024).toFixed(1);
console.log(`✓ single-file export: ${deck.slides.length} slides (${deck.meta.theme} theme) → ${outPath} (${mb} MB)`);
