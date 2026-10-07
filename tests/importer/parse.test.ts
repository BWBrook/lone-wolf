import { describe, expect, it } from 'vitest';
import { parseBook } from '../../src/importer/parse';
import { stableJson } from '../../src/importer/output';
import { sha256 } from '../../src/importer/source';
import { choice, html, source } from './fixture';

describe('synthetic simpler-XHTML import', () => {
  it('preserves source order, duplicate targets, entities, combats, notes, markers and terminal meanings', () => {
    const input = source(html({
      1: `<p>Test &amp; punctuation&nbsp;here. <a href="#sect1-1-foot" id="sect1-1">1</a></p>
        ${choice(2)}${choice(2)}${choice(3)}<div class="illustration">[Test illustration]</div>
        <span class="signpost">A<br>B</span><blockquote><p>Test quote.</p></blockquote>`,
      2: `<p>Before.</p><p class="combat">Test enemy A: COMBAT&nbsp;SKILL 13 ENDURANCE 11</p>
        <p>Between.</p><p class="combat">Test enemy B: COMBAT SKILL 14 ENDURANCE 12</p>${choice(4)}`,
      3: '<p class="deadend">Test ending.</p>',
    }, '<div class="backmatter"><p><a id="sect1-1-foot" href="#sect1-1">1</a> Original test footnote.</p><p>Appendix test.</p></div>'));
    const book = parseBook(input), first = book.sections[0]!;
    expect(book.sourceSha256).toBe(sha256(input.bytes));
    expect(first.choices.map((c) => [c.ordinal, c.target])).toEqual([[1, 2], [2, 2], [3, 3]]);
    expect(first.blocks[0]).toEqual({ kind: 'paragraph', text: 'Test & punctuation here. 1', footnoteRefs: ['sect1-1-foot'] });
    expect(first.blocks.map((b) => b.kind)).toEqual(['paragraph', 'choice', 'choice', 'choice', 'illustration', 'signpost', 'quote']);
    expect(book.sections[1]!.combats.map((c) => [c.name, c.combatSkill, c.endurance])).toEqual([['Test enemy A', 13, 11], ['Test enemy B', 14, 12]]);
    expect(book.sections[1]!.blocks.map((b) => b.kind)).toEqual(['paragraph', 'combat', 'paragraph', 'combat', 'choice']);
    expect(book.sections[2]!.deadEnd).toBe(true);
    expect(book.sections[349]!.deadEnd).toBe(false);
    expect(book.sections[349]!.blocks).toHaveLength(1);
    expect(book.footnotes[0]?.id).toBe('sect1-1-foot');
    expect(book.illustrations[0]).toEqual({ id: 's1_illustration1', section: 1, label: '[Test illustration]', file: null });
    expect(book.frontMatter.find((p) => p.id === 'gamerulz')?.blocks.map((b) => b.text)).toEqual(['Original test instructions.', 'Test item one.', 'Test item two.']);
    expect(stableJson(parseBook(input))).toBe(stableJson(book));
    expect(stableJson(book.sections[349])).not.toContain('Appendix test');
  });
  it('ignores non-choice numeric and footnote links when building graph edges', () => {
    const book = parseBook(source(html({ 1: `<p><a href="#sect300">Narrative link.</a></p><p class="choice"><a href="#random">Test table.</a><a href="#sect2">Continue.</a></p>` })));
    expect(book.sections[0]!.choices).toHaveLength(1);
  });
  it.each([
    ['two targets', { 1: `<p class="choice"><a href="#sect2">A</a><a href="#sect3">B</a></p>` }, /one choice target/],
    ['missing target', { 1: choice(351) }, /missing target/],
    ['unknown block', { 1: `<div class="unknown">Test content.</div>${choice(2)}` }, /unsupported block/],
    ['zero combat', { 1: `<p class="combat">Test: COMBAT SKILL 0 ENDURANCE 10</p>${choice(2)}` }, /invalid combat/],
    ['unrecognized combat', { 1: `<p class="combat">Test: COMBAT SKILL -1 ENDURANCE 10</p>${choice(2)}` }, /unrecognized combat/],
    ['dead end with choices', { 1: `<p class="deadend">Test.</p>${choice(2)}` }, /dead end/],
    ['missing footnote', { 1: `<p><a href="#sect1-1-foot">1</a></p>${choice(2)}` }, /unresolved footnote/],
  ] as const)('rejects %s instead of dropping content', (_name, overrides, error) => {
    expect(() => parseBook(source(html(overrides)))).toThrow(error);
  });
  it('rejects missing/duplicate numeric sections and invalid UTF-8', () => {
    expect(() => parseBook(source(html().replace('<h3><a id="sect2">2</a></h3>', '')))).toThrow(/every section/);
    expect(() => parseBook(source(html().replace('id="sect2"', 'id="sect1"')))).toThrow(/every section|duplicate section/);
    expect(() => parseBook({ ...source(), bytes: Uint8Array.of(0xff) })).toThrow();
  });
});
