#!/usr/bin/env node
/* ============================================================
   ingest-pptx.mjs — PPTX → Deck IR on the CLI (Node 18+).

     node platform/ingest/ingest-pptx.mjs <in.pptx> <out-deck.json> [theme]

   Same modules the browser Studio uses — zero dependencies.
   Compose the result with platform/compose/build-deck.mjs.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { extractPptx } from "./pptx.js";
import { mapToDeckIR } from "./map.js";

const [, , inPath, outPath, theme = "aurora"] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node ingest-pptx.mjs <in.pptx> <out-deck.json> [theme]");
  process.exit(1);
}

const buf = readFileSync(inPath);
const raw = await extractPptx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const deck = mapToDeckIR(raw, { theme });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(deck, null, 2));
console.log(`✓ ingested ${raw.slides.length} slides ("${deck.meta.title}") → ${outPath} (${theme} theme)`);
