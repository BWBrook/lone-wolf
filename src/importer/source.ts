import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { Unzip, UnzipInflate, unzipSync } from 'fflate';

export const MAX_INPUT_BYTES = 32 * 1024 * 1024;
export const MAX_HTML_BYTES = 8 * 1024 * 1024;
export const MEMBER = 'en/xhtml-simple/lw/01fftd.htm';
export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export interface Source { bytes: Uint8Array; entryPath: string; archiveSha256: string | null }

export async function readBounded(input: string, limit = MAX_INPUT_BYTES): Promise<Uint8Array> {
  if (/^[a-z][a-z\d+.-]*:/i.test(input)) {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('only HTTP(S) URLs are supported');
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel();
      throw new Error(`input exceeds ${limit} bytes`);
    }
    if (!response.body) throw new Error('empty download');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new Error(`input exceeds ${limit} bytes`);
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks, size);
  }
  // Read at most limit + 1, even if the file grows after stat.
  const file = await open(input, 'r');
  try {
    if ((await file.stat()).size > limit) throw new Error(`input exceeds ${limit} bytes`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit + 1 - size));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > limit) throw new Error(`input exceeds ${limit} bytes`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, size);
  } finally { await file.close(); }
}

export function extractSource(input: Uint8Array, inputName: string): Source {
  if (input.length > MAX_INPUT_BYTES) throw new Error('input exceeds size limit');
  const isZip = input[0] === 0x50 && input[1] === 0x4b;
  if (!isZip) {
    const name = basename(/^https?:/i.test(inputName) ? new URL(inputName).pathname : inputName);
    if (name !== '01fftd.htm') throw new Error('expected the Book 1 simpler-XHTML ZIP or 01fftd.htm');
    if (input.length > MAX_HTML_BYTES) throw new Error('HTML exceeds size limit');
    return { bytes: input, entryPath: name, archiveSha256: null };
  }
  // Inspect the central directory without decompressing. This also rejects
  // truncated archives and duplicate expected members before streaming them.
  let members = 0;
  unzipSync(input, { filter: (info) => {
    if (info.name === MEMBER) {
      members++;
      if (info.originalSize > MAX_HTML_BYTES) throw new Error('HTML exceeds size limit');
      if (![0, 8].includes(info.compression)) throw new Error('unsupported ZIP compression');
    }
    return false;
  } });
  if (members !== 1) throw new Error(`expected exactly one ${MEMBER}, found ${members}`);

  const chunks: Uint8Array[] = [];
  let size = 0, localMembers = 0, complete = false;
  const stream = new Unzip((file) => {
    if (file.name !== MEMBER) return;
    localMembers++;
    if (localMembers !== 1) throw new Error('duplicate ZIP member');
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length;
      if (size > MAX_HTML_BYTES) { file.terminate(); throw new Error('HTML exceeds size limit'); }
      chunks.push(chunk);
      complete = final;
    };
    file.start();
  });
  stream.register(UnzipInflate);
  // Bound each inflation allocation as well as the total actual output, rather
  // than trusting the archive's advertised uncompressed size.
  for (let offset = 0; offset < input.length; offset += 1024) {
    stream.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length);
  }
  if (!complete || localMembers !== 1) throw new Error('incomplete ZIP member');
  return { bytes: Buffer.concat(chunks, size), entryPath: MEMBER, archiveSha256: sha256(input) };
}

export const loadSource = async (input: string): Promise<Source> => extractSource(await readBounded(input), input);
export const decode = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
