import { afterEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import { extractSource, MAX_HTML_BYTES, MEMBER, readBounded, sha256 } from '../../src/importer/source';
import { archive, html } from './fixture';

afterEach(() => vi.unstubAllGlobals());
describe('bounded sources', () => {
  it('selects only the exact ZIP member and identifies the raw bytes independently of the ZIP', () => {
    const bytes = Buffer.from(html()), zip = archive();
    const fromZip = extractSource(zip, 'download.zip');
    expect(Buffer.from(fromZip.bytes)).toEqual(bytes);
    expect(fromZip.archiveSha256).toBe(sha256(zip));
    expect(sha256(extractSource(bytes, '01fftd.htm').bytes)).toBe(sha256(fromZip.bytes));
  });
  it('rejects missing, duplicate, truncated and oversized members', () => {
    expect(() => extractSource(zipSync({ 'elsewhere/01fftd.htm': Buffer.from(html()) }), 'test.zip')).toThrow(/exactly one/);
    const alternate = MEMBER.replace('01fftd', '02test');
    const duplicated = Buffer.from(zipSync({ [MEMBER]: Buffer.from(html()), [alternate]: Buffer.from(html()) }));
    // Change both local and central names of the second synthetic entry to the
    // expected name. The established library still parses the resulting ZIP.
    for (let start = 0; ; ) {
      const index = duplicated.indexOf(alternate, start);
      if (index < 0) break;
      duplicated.write(MEMBER, index); start = index + MEMBER.length;
    }
    expect(() => extractSource(duplicated, 'test.zip')).toThrow(/exactly one/);
    expect(() => extractSource(archive().slice(0, -25), 'test.zip')).toThrow();
    expect(() => extractSource(zipSync({ [MEMBER]: new Uint8Array(MAX_HTML_BYTES + 1) }), 'test.zip')).toThrow(/size limit/);
    expect(() => extractSource(Buffer.from(html()), 'other.htm')).toThrow(/Book 1/);
  });
  it('bounds HTTP bodies using both headers and actual stream length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('12345')));
    await expect(readBounded('https://example.test/01fftd.htm', 4)).rejects.toThrow(/exceeds/);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { headers: { 'content-length': '100' } })));
    await expect(readBounded('https://example.test/01fftd.htm', 4)).rejects.toThrow(/exceeds/);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('abc')));
    expect(Buffer.from(await readBounded('https://example.test/01fftd.htm', 4)).toString()).toBe('abc');
    await expect(readBounded('ftp://example.test/book')).rejects.toThrow(/HTTP/);
  });
  it('bounds actual inflation even when ZIP size declarations understate it', () => {
    const zip = Buffer.from(zipSync({ [MEMBER]: new Uint8Array(MAX_HTML_BYTES + 1) }));
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThan(0);
    zip.writeUInt32LE(1, central + 24);
    zip.writeUInt32LE(1, 22);
    expect(() => extractSource(zip, 'test.zip')).toThrow(/size limit/);
  });
});
