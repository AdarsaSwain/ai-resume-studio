import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { docxText, documentXmlToText, zipEntry } from '../src/docx.js';

/* Builds a minimal zip archive in memory. */
function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, text, store] of files) {
    const raw = Buffer.from(text), data = store ? raw : zlib.deflateRawSync(raw), n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, data); centrals.push(central, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const b = Buffer.concat([...locals, cd, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

const XML = '<w:document><w:body>' +
  '<w:p><w:r><w:t>Meera Kulkarni</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">R&amp;D </w:t></w:r><w:r><w:tab/><w:t>Jan 2026</w:t></w:r></w:p>' +
  '<w:p></w:p>' +
  '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Built REST APIs &#8211; in Flask</w:t></w:r></w:p>' +
  '</w:body></w:document>';

test('document XML becomes one line per paragraph with list items bulleted', () => {
  assert.equal(documentXmlToText(XML), 'Meera Kulkarni\nR&D \tJan 2026\n\n• Built REST APIs – in Flask');
});

test('docxText reads a deflated or stored document.xml out of the archive', async () => {
  for (const store of [false, true]) {
    const buf = zip([['[Content_Types].xml', '<Types/>', store], ['word/document.xml', XML, store]]);
    assert.ok((await docxText(buf)).startsWith('Meera Kulkarni\nR&D'));
  }
});

test('files that are not Word documents are rejected', async () => {
  await assert.rejects(docxText(new TextEncoder().encode('plain text, long enough to scan for a zip footer').buffer), /notzip/);
  await assert.rejects(docxText(zip([['other.txt', 'x', true]])), /notdocx/);
  assert.equal(await zipEntry(zip([['a.txt', 'x', true]]), 'missing'), null);
});
