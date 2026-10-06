import { describe, expect, it } from 'vitest';
import {
  IllegalAction,
  apply,
  availableActions,
  exportCharacter,
  maxEndurance,
  newGame,
  replay,
  type Action,
  type GameState,
} from '../../src/engine';
import { book } from './fixture';

// A seeded random player, independent of the engine's own RNG.
function play(seed: number, maxSteps = 300) {
  let x = seed * 2654435761;
  const pick = <T>(xs: T[]) => {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
    return xs[(x >>> 0) % xs.length]!;
  };
  let state = newGame(seed);
  const actions: Action[] = [];
  const states: GameState[] = [state];
  for (let i = 0; i < maxSteps; i++) {
    const options = availableActions(book, state);
    if (!options.length) break;
    const action = pick(options);
    actions.push(action);
    state = apply(book, state, action).state;
    states.push(state);
  }
  return { state, actions, states };
}

describe('saves', () => {
  it('replay to exactly the same state', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { state, actions } = play(seed);
      expect(replay(book, { version: 1, book: 'test', sourceSha256: 'synthetic', seed, actions })).toEqual(state);
    }
  });

  it('are refused for a different book or edition', () => {
    expect(() => replay(book, { version: 1, book: 'test', sourceSha256: 'other', seed: 1, actions: [] })).toThrow();
  });

  it('are made of legal actions only', () => {
    expect(() => apply(book, newGame(1), { type: 'fight' })).toThrow(IllegalAction);
  });
});

describe('random play', () => {
  it('never breaks the carrying, gold or ENDURANCE limits', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const { character: c, phase } of play(seed).states) {
        expect(c.weapons.length).toBeLessThanOrEqual(2);
        expect(c.backpack.length).toBeLessThanOrEqual(8);
        expect(c.gold).toBeGreaterThanOrEqual(0);
        expect(c.gold).toBeLessThanOrEqual(50);
        expect(c.endurance).toBeGreaterThanOrEqual(0);
        expect(c.endurance).toBeLessThanOrEqual(maxEndurance(book, c));
        if (c.endurance === 0 && phase !== 'stats' && phase !== 'disciplines') expect(phase).toBe('dead');
      }
    }
  });
});

describe('character export', () => {
  it('is available only after winning, as a versioned record', () => {
    const results = Array.from({ length: 200 }, (_, seed) => play(seed).state);
    const won = results.find((s) => s.phase === 'won')!;
    const lost = results.find((s) => s.phase === 'dead')!;
    expect(exportCharacter(book, won)).toMatchObject({ version: 1, completedBook: 'test' });
    expect(() => exportCharacter(book, lost)).toThrow();
  });
});
