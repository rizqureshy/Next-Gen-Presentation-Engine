/* ============================================================
   pptx.js — PPTX → raw slide structure. Zero dependencies;
   runs in the browser and Node 18+.

   Reads the OOXML actually needed for re-expression (not
   pixel-perfect layout): slide order, placeholder roles,
   paragraph text with bullet levels, embedded images (as data
   URIs), and speaker notes.

   extractPptx(buffer) → {
     title,                       // from docProps/core.xml if present
     slides: [{
       title, subtitle,           // from title/subTitle placeholders
       bodies: [[{text, lvl, bold}, …], …],  // one array per body shape
       images: [dataUri, …],
       notes,                     // speaker notes text
     }]
   }
   ============================================================ */

import { unzip } from "./zip.js";
import { parseXml, findAll, findFirst, textOf, walk, isElement } from "./xml.js";

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  bmp: "image/bmp", tiff: "image/tiff", emf: "image/emf", wmf: "image/wmf",
};

const dec = new TextDecoder();

function toDataUri(name, bytes) {
  const ext = name.split(".").pop().toLowerCase();
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${MIME[ext] || "application/octet-stream"};base64,${btoa(bin)}`;
}

/* parse a .rels file → Map<rId, target path resolved from baseDir> */
function parseRels(xmlStr, baseDir) {
  const rels = new Map();
  if (!xmlStr) return rels;
  for (const r of findAll(parseXml(xmlStr), "Relationship")) {
    let target = r.attrs.Target || "";
    if (!target.startsWith("/")) {
      // resolve ../ against baseDir
      const parts = (baseDir + "/" + target).split("/");
      const out = [];
      for (const p of parts) {
        if (p === "..") out.pop();
        else if (p !== "." && p !== "") out.push(p);
      }
      target = out.join("/");
    } else {
      target = target.slice(1);
    }
    rels.set(r.attrs.Id, { target, type: r.attrs.Type || "" });
  }
  return rels;
}

/* one paragraph <a:p> → { text, lvl, bold } (null if empty) */
function readParagraph(p) {
  let text = "";
  let bold = false;
  for (const node of walk(p)) {
    if (!isElement(node)) continue;
    if (node.tag === "a:t") text += textOf(node);
    else if (node.tag === "a:br") text += " ";
  }
  // bold if the first run carries b="1"
  const firstRun = findFirst(p, "a:r");
  if (firstRun) {
    const rPr = findFirst(firstRun, "a:rPr");
    bold = rPr?.attrs.b === "1";
  }
  const pPr = findFirst(p, "a:pPr");
  const lvl = parseInt(pPr?.attrs.lvl || "0", 10) || 0;
  text = text.replace(/\s+/g, " ").replace(/[{}]/g, "").trim();
  return text ? { text, lvl, bold } : null;
}

const SKIP_PH = new Set(["sldNum", "dt", "ftr"]);

export async function extractPptx(buffer) {
  const files = await unzip(buffer);
  const get = (name) => files.has(name) ? dec.decode(files.get(name)) : null;

  // deck title from core properties
  let deckTitle = "";
  const core = get("docProps/core.xml");
  if (core) {
    const t = findFirst(parseXml(core), "dc:title");
    if (t) deckTitle = textOf(t).trim();
  }

  // slide order: presentation.xml sldIdLst → r:id → presentation rels
  const presXml = get("ppt/presentation.xml");
  if (!presXml) throw new Error("Not a PPTX (missing ppt/presentation.xml)");
  const presRels = parseRels(get("ppt/_rels/presentation.xml.rels"), "ppt");
  const slidePaths = [];
  for (const sldId of findAll(parseXml(presXml), "p:sldId")) {
    const rel = presRels.get(sldId.attrs["r:id"]);
    if (rel?.target) slidePaths.push(rel.target);
  }

  const slides = [];
  for (const path of slidePaths) {
    const xml = get(path);
    if (!xml) continue;
    const doc = parseXml(xml);
    const dir = path.slice(0, path.lastIndexOf("/"));
    const relPath = `${dir}/_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`;
    const rels = parseRels(get(relPath), dir);

    const slide = { title: "", subtitle: "", bodies: [], images: [], notes: "" };

    for (const sp of findAll(doc, "p:sp")) {
      const ph = findFirst(sp, "p:ph");
      const type = ph?.attrs.type || (ph ? "body" : "text");
      if (SKIP_PH.has(type)) continue;

      const paras = findAll(sp, "a:p").map(readParagraph).filter(Boolean);
      if (!paras.length) continue;

      if (type === "title" || type === "ctrTitle") {
        slide.title = paras.map((p) => p.text).join(" — ");
      } else if (type === "subTitle") {
        slide.subtitle = paras.map((p) => p.text).join(" ");
      } else {
        slide.bodies.push(paras);
      }
    }

    // images: p:pic → a:blip r:embed → slide rels → ppt/media/*
    for (const pic of findAll(doc, "p:pic")) {
      const blip = findFirst(pic, "a:blip");
      const rid = blip?.attrs["r:embed"];
      const rel = rid && rels.get(rid);
      if (rel && files.has(rel.target)) {
        slide.images.push(toDataUri(rel.target, files.get(rel.target)));
      }
    }

    // speaker notes via the notesSlide relationship
    for (const [, rel] of rels) {
      if (rel.type.endsWith("/notesSlide") && files.has(rel.target)) {
        const notesDoc = parseXml(dec.decode(files.get(rel.target)));
        const chunks = [];
        for (const sp of findAll(notesDoc, "p:sp")) {
          const ph = findFirst(sp, "p:ph");
          if (ph?.attrs.type && ph.attrs.type !== "body") continue;  // skip slide image/number
          for (const p of findAll(sp, "a:p")) {
            const para = readParagraph(p);
            if (para) chunks.push(para.text);
          }
        }
        slide.notes = chunks.join("\n");
      }
    }

    slides.push(slide);
  }

  return { title: deckTitle, slides };
}
