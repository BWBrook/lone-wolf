import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { checkGraph, checkRules, compareSvg } from '../../src/importer/graph';
import { parseBook } from '../../src/importer/parse';
import type { ImportedBook } from '../../src/engine/types';
import { imported as engineFixture, rules as engineRules } from '../engine/fixture';
import { choice, html, source, svg } from './fixture';

describe('directed graph checker', () => {
  it('checks all reachability, successful ending and edge multiplicity', () => {
    const book = parseBook(source(html({ 1: `${choice(2)}${choice(2)}` })));
    const report = checkGraph(book);
    expect(report.ok).toBe(true);
    expect(report.counts).toMatchObject({ sections: 350, choices: 350, uniqueEdges: 349 });
    expect(report.reachable).toHaveLength(350);
    expect(report.finalReachable).toBe(true);
    const edges = book.sections.flatMap((s) => s.choices.map((c) => `${s.number}->${c.target}`));
    expect(compareSvg(book, svg(['title->001', ...edges])).status).toBe('passed');
    const fewer = compareSvg(book, svg(edges.slice(1)));
    expect(fewer).toMatchObject({ status: 'failed', missing: ['1->2'], extra: [] });
    expect(compareSvg(book, gzipSync(svg(edges))).status).toBe('passed');
    expect(compareSvg(book, svg([...edges, '2->1']))).toMatchObject({ status: 'failed', extra: ['2->1'] });
  });
  it('reports structural problems and unreachable terminals', () => {
    const book: ImportedBook = { id: '01fftd', sourceSha256: 'synthetic', sections: [
      { number: 1, choices: [{ ordinal: 2, target: 9 }], combats: [], deadEnd: true },
      { number: 350, choices: [], combats: [], deadEnd: false },
    ] };
    const report = checkGraph(book);
    expect(report.ok).toBe(false);
    expect(report.unreachable).toEqual([350]);
    expect(report.problems.join('\n')).toMatch(/missing target 9/);
    expect(report.problems.join('\n')).toMatch(/dead end 1/);
    expect(report.problems.join('\n')).toMatch(/invalid choice/);
  });
  it('rejects malformed or extra title edges rather than silently excluding them', () => {
    const book = parseBook(source());
    expect(() => compareSvg(book, svg(['title->002']))).toThrow(/unrecognized SVG edge/);
    expect(() => compareSvg(book, svg(['title->001', 'title->001']))).toThrow(/duplicate SVG title/);
    expect(() => compareSvg(book, Buffer.from('<svg><g class="edge"></g></svg>'))).toThrow(/one title/);
  });
  it('does not accept a truncated Book 1 just because 350 remains reachable', () => {
    const book: ImportedBook = { id: '01fftd', sourceSha256: 'synthetic', sections: [
      { number: 1, choices: [{ ordinal: 1, target: 350 }], combats: [], deadEnd: false },
      { number: 350, choices: [], combats: [], deadEnd: false },
    ] };
    expect(checkGraph(book)).toMatchObject({ ok: false, finalReachable: true, unreachable: [] });
    expect(checkGraph(book).problems).toContain('Book 1 requires every section 1–350 exactly once');
  });
  it('uses the existing strict loader for supplied rules', () => {
    expect(() => checkRules(engineFixture, engineRules)).not.toThrow();
    expect(() => checkRules(engineFixture, { ...engineRules, sections: {} })).toThrow(/sections without rules/);
  });
});
