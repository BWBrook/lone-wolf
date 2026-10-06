import { describe, expect, it } from 'vitest';
import { apply, availableActions, newGame } from '../../src/engine';
import { demoBook } from '../../src/ui/demo';

describe('demo book', () => {
  it('has rules and text for every section', () => {
    expect(demoBook.engine.unreviewed).toEqual([]);
    for (const n of Object.keys(demoBook.engine.sections)) expect(demoBook.text[Number(n)]).toBeDefined();
  });

  it('can be played to an ending', () => {
    const endings = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      let s = newGame(seed);
      for (let step = 0; step < 200 && availableActions(demoBook.engine, s).length; step++) {
        const options = availableActions(demoBook.engine, s);
        s = apply(demoBook.engine, s, options[(seed * 31 + step * 7) % options.length]!).state;
      }
      endings.add(s.phase);
    }
    expect(endings).toEqual(new Set(['won', 'dead']));
  });
});
