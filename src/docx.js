/* Reads the text of a Word .docx file with no dependencies.
   A .docx is a zip archive; the body lives in word/document.xml. */

const u16 = (v, o) => v.getUint16(o, true), u32 = (v, o) => v.getUint32(o, true);

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* Returns the bytes of one file inside a zip, or null when it is not there. */
export async function zipEntry(buffer, wanted) {
  const v = new DataView(buffer), bytes = new Uint8Array(buffer), dec = new TextDecoder();
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= 0 && i >= buffer.byteLength - 65557; i--) if (u32(v, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('notzip');
  let p = u32(v, end + 16);
  for (let n = u16(v, end + 10); n > 0 && u32(v, p) === 0x02014b50; n--) {
    const method = u16(v, p + 10), size = u32(v, p + 20), nameLen = u16(v, p + 28), local = u32(v, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + u16(v, local + 26) + u16(v, local + 28), data = bytes.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error('method');
    }
    p += 46 + nameLen + u16(v, p + 30) + u16(v, p + 32);
  }
  return null;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = s => s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m));

/* Turns word/document.xml into plain text: one line per paragraph, list items marked with a bullet. */
export function documentXmlToText(xml) {
  const out = [];
  for (const para of xml.split(/<\/w:p>/)) {
    let line = '';
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\s*\/>/g;
    let m;
    while ((m = re.exec(para))) line += m[1] !== undefined ? unescape(m[1]) : m[0].startsWith('<w:tab') ? '\t' : '\n';
    line = line.trim();
    if (line) out.push((/<w:numPr[\s>]/.test(para) ? '• ' : '') + line);
    else if (out.length && out[out.length - 1] !== '') out.push('');
  }
  return out.join('\n').trim();
}

export async function docxText(buffer) {
  const xml = await zipEntry(buffer, 'word/document.xml');
  if (!xml) throw new Error('notdocx');
  return documentXmlToText(new TextDecoder().decode(xml));
}
