/* ============================================================
   bundle.js — Deck IR → a decomposed .zip bundle.

   The zip unzips to a folder that runs on any static host:
     index.html + platform/{engine,themes/<id>} + vendor libs.
   Same structure as this repo, so paths compose with base ".".

   Isomorphic: pass { readFile } (Node fs or browser fetch).
   ============================================================ */

import { composeDeck } from "../compose/composer.js";
import { buildZip } from "./zip-write.js";

const THEME_ADDONS = {
  tiles: ["assets/vendor/three/addons/geometries/RoundedBoxGeometry.js"],
};

export function bundleFileList(theme) {
  return [
    "platform/engine/deck.css",
    "platform/engine/theme.js",
    "platform/engine/engine.js",
    `platform/themes/${theme}/${theme}.js`,
    `platform/themes/${theme}/${theme}.css`,
    "assets/vendor/gsap.min.js",
    "assets/vendor/three/three.module.js",
    ...(THEME_ADDONS[theme] || []),
  ];
}

/**
 * @param {object} deck  Deck IR
 * @param {object} opts  { readFile(path) → Promise<string> }
 * @returns {Promise<Uint8Array>} zip bytes
 */
export async function composeBundle(deck, { readFile }) {
  const theme = deck.meta.theme || "cosmos";
  const enc = new TextEncoder();

  const files = [
    { name: "index.html", data: enc.encode(composeDeck(deck, { base: "." })) },
    { name: "deck.json", data: enc.encode(JSON.stringify(deck, null, 2)) },
  ];
  for (const path of bundleFileList(theme)) {
    files.push({ name: path, data: enc.encode(await readFile(path)) });
  }
  return buildZip(files);
}
