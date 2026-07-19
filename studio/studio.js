/* ============================================================
   studio.js — the Studio app: PPTX in, themed deck out.

   Everything client-side: the PPTX is unzipped, parsed, and
   mapped to Deck IR in this tab; the composer renders the same
   HTML the CLI produces into a srcdoc iframe (relative asset
   paths resolve against /studio/, so ../platform/... works).
   ============================================================ */

import { extractPptx } from "../platform/ingest/pptx.js";
import { mapToDeckIR } from "../platform/ingest/map.js";
import { composeDeck } from "../platform/compose/composer.js";

const THEMES = [
  ["cosmos", "Cosmos"], ["aurora", "Aurora"], ["lasers", "Lasers"],
  ["tiles", "Tiles"], ["ink", "Ink"],
];

const $ = (id) => document.getElementById(id);
let deck = null;

/* ---------- status ---------- */
function status(msg, isErr = false) {
  $("status").textContent = msg;
  $("status").classList.toggle("err", isErr);
}

/* ---------- preview + controls ---------- */
function refresh() {
  if (!deck) return;
  try {
    const html = composeDeck(deck, { base: ".." });
    $("preview").srcdoc = html;
    $("preview").hidden = false;
    $("empty").style.display = "none";
    $("controls").hidden = false;
    $("brand").value = deck.meta.brand || "";
    $("credit").value = deck.meta.credit || "";
    $("ir").value = JSON.stringify(deck, null, 2);
    document.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("on", c.dataset.theme === (deck.meta.theme || "cosmos")));
  } catch (e) {
    status(`Compose failed: ${e.message}`, true);
  }
}

/* ---------- theme chips ---------- */
for (const [id, label] of THEMES) {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.theme = id;
  b.textContent = label;
  b.addEventListener("click", () => {
    deck.meta.theme = id;
    refresh();
    status(`Theme: ${label}`);
  });
  $("themes").appendChild(b);
}

/* ---------- ingest ---------- */
async function ingest(file) {
  try {
    status(`Reading ${file.name}…`);
    const raw = await extractPptx(await file.arrayBuffer());
    if (!raw.slides.length) throw new Error("no slides found");
    deck = mapToDeckIR(raw, { theme: deck?.meta.theme || "aurora" });
    refresh();
    status(`Ingested ${raw.slides.length} slides — pick a theme, then download.`);
  } catch (e) {
    status(`Could not read that file: ${e.message}`, true);
  }
}

$("file").addEventListener("change", (e) => {
  if (e.target.files[0]) ingest(e.target.files[0]);
});
const drop = $("drop");
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) ingest(f);
});

/* ---------- sample deck ---------- */
$("sample").addEventListener("click", async () => {
  try {
    deck = await (await fetch("../platform/compose/example-deck.json")).json();
    refresh();
    status("Loaded the sample deck.");
  } catch (e) {
    status(`Could not load sample: ${e.message}`, true);
  }
});

/* ---------- meta inputs + IR edits ---------- */
$("brand").addEventListener("change", () => { deck.meta.brand = $("brand").value; refresh(); });
$("credit").addEventListener("change", () => { deck.meta.credit = $("credit").value; refresh(); });
$("apply").addEventListener("click", () => {
  try {
    deck = JSON.parse($("ir").value);
    refresh();
    status("IR applied.");
  } catch (e) {
    status(`Bad JSON: ${e.message}`, true);
  }
});

/* ---------- downloads ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("dl-json").addEventListener("click", () =>
  download("deck.json", JSON.stringify(deck, null, 2), "application/json"));
$("dl-html").addEventListener("click", () =>
  download("index.html", composeDeck(deck, { base: "../.." }), "text/html"));
