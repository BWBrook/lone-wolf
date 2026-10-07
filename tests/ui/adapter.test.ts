import { describe, expect, it } from 'vitest';
import { apply, availableActions, newGame } from '../../src/engine';
import { parseBook } from '../../src/importer/parse';
import { playableBook, readerBook } from '../../src/ui/adapter';
import { choice, html, source } from '../importer/fixture';

// Synthetic importer output: 350 invented sections, one with a fight and a footnote.
const book = parseBook(
  source(
    html({
      2: `<p>Test fight room.</p><p class="combat">Test beast: COMBAT SKILL 12 ENDURANCE 9</p>${choice(3)}${choice(3)}`,
      3: `<p>Test note room<a href="#sect3-1-foot">*</a>.</p>${choice(4)}`,
    }, '<div class="footnotes"><p><a id="sect3-1-foot">*</a> Test footnote.</p></div>'),
  ),
);

describe('player adapter', () => {
  it('maps text blocks, choices, enemies and footnotes for display', () => {
    const playable = readerBook(book);
    expect(playable.title).toBe('Synthetic book');
    expect(playable.text[2]).toEqual({
      paragraphs: ['Test fight room.'],
      notes: [],
      choices: { 1: 'Continue test.', 2: 'Continue test.' },
      enemies: ['Test beast'],
    });
    expect(playable.text[3]!.notes).toEqual(['* Test footnote.']);
  });

  it('gives the engine structure only, never prose', () => {
    const engine = readerBook(book).engine;
    expect(engine.sections[2]).toEqual({
      number: 2,
      choices: [{ ordinal: 1, target: 3 }, { ordinal: 2, target: 3 }],
      combats: [{ combatSkill: 12, endurance: 9 }],
      deadEnd: false,
      rules: {},
    });
    expect(JSON.stringify(engine)).not.toContain('Test');
  });

  it('refuses rules that leave sections unreviewed outside reader mode', () => {
    const rules = { book: '01fftd', finalSection: 350, items: {}, setup: { disciplines: 5, items: [], goldBase: 0, randomItem: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), {}])) }, sections: {} };
    expect(() => playableBook(book, rules)).toThrow(/sections without rules/);
  });

  it('lets reader mode walk the text to the final section', () => {
    let s = newGame(1);
    for (let i = 0; i < 2000 && availableActions(readerBook(book).engine, s).length; i++) {
      const engine = readerBook(book).engine;
      const actions = availableActions(engine, s);
      s = apply(engine, s, actions.find((a) => a.type === 'choose') ?? actions[0]!).state;
    }
    expect(s.phase).toBe('won');
  });
});
