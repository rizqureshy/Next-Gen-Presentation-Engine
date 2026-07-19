/* ============================================================
   zip.js — minimal ZIP reader, zero dependencies.

   PPTX files are standard deflate ZIPs; modern browsers and
   Node 18+ both ship native raw-deflate decompression
   (DecompressionStream), so no vendored inflate is needed.
   Supports stored (0) and deflated (8) entries; no zip64, no
   encryption — fine for real-world PPTX.
   ============================================================ */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer  the .zip / .pptx bytes
 * @returns {Promise<Map<string, Uint8Array>>}  entry name → bytes
 */
export async function unzip(buffer) {
  const buf = buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // find End Of Central Directory (scan back through the comment area)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a ZIP file (no end-of-central-directory)");

  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);

  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== CEN_SIG) throw new Error("Bad central directory entry");
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));

    // local header repeats name/extra with its own lengths
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);

    if (!name.endsWith("/")) {
      files.set(name, method === 0 ? data.slice() : await inflateRaw(data));
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
