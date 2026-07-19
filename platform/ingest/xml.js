/* ============================================================
   xml.js — mini XML parser, zero dependencies.

   Just enough XML for machine-generated OOXML: elements,
   attributes, text, CDATA, comments, self-closing tags, and
   the five named entities + numeric refs. Runs identically in
   the browser and Node (no DOMParser needed). Not a general
   XML parser — don't feed it DTDs or hostile input.

   Elements: { tag, attrs, children } where children mixes
   child elements and text strings.
   ============================================================ */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return ENTITIES[e] ?? m;
  });
}

const ATTR_RE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(str) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  let i = 0;

  while (i < str.length) {
    const lt = str.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i) {
      const text = str.slice(i, lt);
      if (text.trim()) stack[stack.length - 1].children.push(decodeEntities(text));
    }
    if (str.startsWith("<!--", lt)) { i = str.indexOf("-->", lt) + 3; continue; }
    if (str.startsWith("<?", lt)) { i = str.indexOf("?>", lt) + 2; continue; }
    if (str.startsWith("<![CDATA[", lt)) {
      const end = str.indexOf("]]>", lt);
      stack[stack.length - 1].children.push(str.slice(lt + 9, end));
      i = end + 3; continue;
    }
    if (str.startsWith("<!", lt)) { i = str.indexOf(">", lt) + 1; continue; }

    const gt = str.indexOf(">", lt);
    let body = str.slice(lt + 1, gt);

    if (body[0] === "/") {              // closing tag
      if (stack.length > 1) stack.pop();
      i = gt + 1; continue;
    }
    const selfClose = body.endsWith("/");
    if (selfClose) body = body.slice(0, -1);

    const sp = body.search(/\s/);
    const tag = sp < 0 ? body : body.slice(0, sp);
    const attrs = {};
    if (sp > 0) {
      ATTR_RE.lastIndex = 0;
      let m;
      while ((m = ATTR_RE.exec(body.slice(sp)))) {
        attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? "");
      }
    }
    const el = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(el);
    if (!selfClose) stack.push(el);
    i = gt + 1;
  }
  return root;
}

export const isElement = (n) => typeof n === "object" && n !== null;

/** depth-first walk of an element and all descendants */
export function* walk(el) {
  yield el;
  for (const c of el.children) if (isElement(c)) yield* walk(c);
}

/** all descendant elements with the given tag (namespaced, e.g. "a:t") */
export function findAll(el, tag) {
  const out = [];
  for (const e of walk(el)) if (e.tag === tag) out.push(e);
  return out;
}

/** first descendant with the given tag, or null */
export function findFirst(el, tag) {
  for (const e of walk(el)) if (e.tag === tag) return e;
  return null;
}

/** concatenated text content of an element */
export function textOf(el) {
  let out = "";
  for (const c of el.children) out += isElement(c) ? textOf(c) : c;
  return out;
}
