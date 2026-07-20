/* ============================================================
   zip-write.js — minimal ZIP writer, zero dependencies.

   Store-only (no compression): deck bundles are a few MB of
   already-minified JS, and store keeps this tiny and universal.
   Works in the browser and Node.
   ============================================================ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// fixed DOS timestamp (2026-07-19 12:00) — deterministic output
const DOS_TIME = (12 << 11) | 0;
const DOS_DATE = ((2026 - 1980) << 9) | (7 << 5) | 19;

/**
 * @param {Array<{name: string, data: Uint8Array}>} files
 * @returns {Uint8Array} the .zip bytes
 */
export function buildZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const localOff = offset;

    const local = [
      u32(0x04034b50), u16(20), u16(0x0800 /* utf-8 names */), u16(0),
      u16(DOS_TIME), u16(DOS_DATE), u32(crc),
      u32(f.data.length), u32(f.data.length),
      u16(name.length), u16(0), name, f.data,
    ];
    for (const c of local) { chunks.push(c); offset += c.length; }

    central.push([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
      u16(DOS_TIME), u16(DOS_DATE), u32(crc),
      u32(f.data.length), u32(f.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(localOff), name,
    ]);
  }

  const cdStart = offset;
  for (const entry of central) {
    for (const c of entry) { chunks.push(c); offset += c.length; }
  }
  const cdSize = offset - cdStart;

  chunks.push(
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdSize), u32(cdStart), u16(0),
  );

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
