import { zipSync } from 'fflate';
import { MEMBER, type Source } from '../../src/importer/source';

// Entirely synthetic; no book excerpts or real-source fixtures.
export function html(overrides: Record<number, string> = {}, appendix = ''): string {
  const sections = Array.from({ length: 350 }, (_, i) => {
    const n = i + 1;
    const body = overrides[n] ?? `<p>Test room ${n}.</p>${n < 350 ? `<p class="choice"><a href="#sect${n + 1}">Next test room.</a></p>` : ''}`;
    return `<h3><a id="sect${n}">${n}</a></h3>${body}`;
  }).join('');
  return `<!doctype html><html><head><title>Synthetic book</title></head><body>
    <div class="frontmatter"><h1><a id="title">Synthetic book</a></h1>
    <h2><a id="gamerulz">Test setup</a></h2><p>Original test instructions.</p>
    <ul><li>Test item one.</li><li>Test item two.</li></ul></div>
    <div class="numbered"><h2><a id="numbered">Test sections</a></h2>${sections}</div>${appendix}</body></html>`;
}
export function source(text = html()): Source { return { bytes: Buffer.from(text), entryPath: '01fftd.htm', archiveSha256: null }; }
export const archive = (text = html()): Uint8Array => zipSync({ [MEMBER]: Buffer.from(text), 'ignored.bin': Buffer.from('test only') });
export const choice = (target: number): string => `<p class="choice"><a href="#sect${target}">Continue test.</a></p>`;
export const svg = (edges: string[]): Uint8Array => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${edges.map((e) => `<g class="edge"><title>${e.replace('->', '-&gt;')}</title></g>`).join('')}</svg>`);
