import { describe, expect, it } from 'vitest';
import { combatResult, ratioColumn } from '../../src/engine';
import { draw10, seedRng } from '../../src/engine/rng';

describe('Combat Results Table', () => {
  it.each([
    [-30, 0], [-11, 0], [-10, 1], [-9, 1], [-8, 2], [-7, 2], [-6, 3], [-5, 3], [-4, 4], [-3, 4], [-2, 5], [-1, 5],
    [0, 6], [1, 7], [2, 7], [3, 8], [4, 8], [5, 9], [6, 9], [7, 10], [8, 10], [9, 11], [10, 11], [11, 12], [30, 12],
  ])('puts ratio %i in column %i', (ratio, column) => {
    expect(ratioColumn(ratio)).toBe(column);
  });

  it("matches the rulebook's worked example (ratio -3, random 6)", () => {
    expect(combatResult(-3, 6)).toEqual([6, 3]);
  });

  it('has killing results only at the extremes', () => {
    expect(combatResult(-11, 1)).toEqual([0, 'k']);
    expect(combatResult(-10, 2)).toEqual([0, 8]);
    expect(combatResult(11, 0)).toEqual(['k', 0]);
    expect(combatResult(7, 0)).toEqual(['k', 0]);
  });

  // Catches transcription errors: a better ratio or a higher roll (1..9 then 0)
  // never hurts the enemy less or the hero more.
  it('is monotone in ratio and in roll', () => {
    const value = (x: number | 'k') => (x === 'k' ? 1000 : x);
    const rolls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    for (let ratio = -12; ratio <= 12; ratio++) {
      for (let i = 0; i < rolls.length; i++) {
        const [e, h] = combatResult(ratio, rolls[i]!).map(value);
        const [e2, h2] = combatResult(ratio + 1, rolls[i]!).map(value);
        expect(e2!).toBeGreaterThanOrEqual(e!);
        expect(h2!).toBeLessThanOrEqual(h!);
        if (i + 1 < rolls.length) {
          const [e3, h3] = combatResult(ratio, rolls[i + 1]!).map(value);
          expect(e3!).toBeGreaterThanOrEqual(e!);
          expect(h3!).toBeLessThanOrEqual(h!);
        }
      }
    }
  });

  it('rejects random numbers outside 0-9', () => {
    expect(() => combatResult(0, 10)).toThrow(RangeError);
  });
});

describe('random numbers', () => {
  it('are reproducible from the seed, including after a JSON round trip', () => {
    const a = seedRng(42);
    const b = JSON.parse(JSON.stringify(seedRng(42)));
    const xs = Array.from({ length: 50 }, () => draw10(a));
    expect(Array.from({ length: 50 }, () => draw10(b))).toEqual(xs);
    expect(Array.from({ length: 50 }, () => draw10(seedRng(43)))).not.toEqual(xs);
  });

  it('are uniform over 0-9', () => {
    const s = seedRng(7);
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) counts[draw10(s)]++;
    for (const n of counts) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });
});
