import { describe, expect, it } from 'vitest';
import {
  apply,
  availableActions,
  availableChoices,
  buildEngineBook,
  exportCharacter,
  holds,
  maxEndurance,
  newSave,
  replay,
  startAt,
  type Action,
  type Character,
  type GameEvent,
  type GameState,
} from '../../src/engine';
import { draw10, drawBelow, nextU32, seedRng, type RngState } from '../../src/engine/rng';

// Synthetic book exercising the schema extensions agreed in board #73 (1117, 1119, 1168).
const c = (ordinal: number, target: number) => ({ ordinal, target });
const plain = (n: number, ...choices: { ordinal: number; target: number }[]) => ({ number: n, choices, combats: [], deadEnd: false });
const fight = (n: number, combatSkill: number, endurance: number, ...choices: { ordinal: number; target: number }[]) => ({
  number: n,
  choices,
  combats: [{ combatSkill, endurance }],
  deadEnd: false,
});
const imported = {
  id: 'ext',
  sourceSha256: 'synthetic',
  sections: [
    plain(1, c(1, 21), c(2, 29), c(3, 99)),
    plain(20, c(1, 30), c(2, 30), c(3, 31)),
    ...[21, 22, 23, 24, 25, 26, 29, 30, 31, 40, 41, 42].map((n) => plain(n, c(1, 99))),
    fight(27, 0, 5, c(1, 99), c(2, 40)),
    fight(28, 15, 1000, c(1, 99), c(2, 41), c(3, 42)),
    fight(32, 15, 1000, c(1, 99)),
    fight(33, 0, 5, c(1, 99), c(2, 41), c(3, 40)),
    fight(34, 15, 30, c(1, 99), c(2, 41)),
    plain(60, c(1, 61), c(2, 62), c(3, 63)),
    plain(61, c(1, 99)),
    plain(62, c(1, 99), c(2, 60)),
    plain(63, c(1, 60)),
    plain(70, c(1, 99)),
    plain(71, c(1, 99)),
    plain(72, c(1, 99), c(2, 99)),
    fight(73, 15, 1000, c(1, 99)),
    plain(99),
  ],
};
const d = (draw: number, range: { min?: number; max?: number }) => ({ random: { draw, ...range } });
const rules = {
  book: 'ext',
  finalSection: 99,
  items: {
    axe: { slot: 'weapon', weapon: 'axe' },
    sword: { slot: 'weapon', weapon: 'sword' },
    meal: { slot: 'backpack', meal: true },
    laumspur: { slot: 'backpack', meal: true, use: { endurance: 3 } },
    potion: { slot: 'backpack', use: { endurance: 4, notBeforeCombat: true } },
    rope: { slot: 'backpack' },
    helmet: { slot: 'special', endurance: 2 },
  },
  setup: {
    disciplines: 5,
    items: [],
    goldBase: 0,
    randomItem: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), {}])),
  },
  sections: {
    ...Object.fromEntries(imported.sections.map((s) => [String(s.number), {}])),
    '20': {
      effects: [
        { op: 'random' },
        { op: 'random', when: d(1, { max: 4 }) },
        { op: 'random', when: { all: [d(1, { max: 4 }), d(2, { max: 7 })] } },
        { op: 'die', when: { all: [d(1, { max: 4 }), d(2, { max: 7 }), d(3, { max: 8 })] } },
      ],
      choices: {
        '1': { when: d(1, { min: 5 }) },
        '2': { when: { all: [d(1, { max: 4 }), d(2, { min: 8 })] } },
        '3': { when: d(3, { min: 9 }) },
      },
    },
    '21': { effects: [{ op: 'restoreEndurance' }] },
    '22': { effects: [{ op: 'combatSkill', delta: -1 }] },
    '23': { effects: [{ op: 'loseAll', slots: ['weapon', 'backpack'] }] },
    '24': { effects: [{ op: 'loseBackpack' }, { op: 'pickup', items: ['meal', 'sword'] }, { op: 'meal' }] },
    '25': { effects: [{ op: 'stealOne', from: 'backpack', fallback: 'weapon' }] },
    '26': { effects: [{ op: 'pickup', items: ['meal'], gold: 40 }, { op: 'meal' }] },
    '27': {
      effects: [{ op: 'combat', combat: 0, onHeroLoss: { choice: 2 } }],
      choices: { '2': { effects: [{ op: 'gold', delta: -1 }] } },
    },
    '28': { effects: [{ op: 'combat', combat: 0, maxRounds: 4, timeout: { choice: 2 }, evade: { afterRounds: 2, choice: 3 } }] },
    '29': { effects: [{ op: 'meal' }] },
    '32': { effects: [{ op: 'combat', combat: 0 }] },
    '33': { effects: [{ op: 'combat', combat: 0, maxRounds: 1, timeout: { choice: 2 }, onHeroLoss: { choice: 3 } }] },
    '34': { effects: [{ op: 'combat', combat: 0, maxRounds: 4, timeout: { choice: 2 } }] },
    '70': { effects: [{ op: 'pickup', items: ['meal', 'meal', 'sword'], backpack: true }] },
    '71': { effects: [{ op: 'loseOne', from: 'weapon' }] },
    '72': { choices: { '1': { when: { inventory: { slot: 'backpack', min: 1 } } } } },
    // The 283 pattern: +2 for the first round only, then -2 without Mindshield.
    '73': {
      effects: [
        {
          op: 'combat',
          combat: 0,
          modifiers: [
            { combatSkill: 2, when: { not: { rounds: { min: 1 } } } },
            { combatSkill: -2, when: { all: [{ rounds: { min: 1 } }, { not: { discipline: 'mindshield' } }] } },
          ],
        },
      ],
    },
    // The 214 -> 125 pattern: returning from 63 allows only 60's second exit.
    '60': {
      choices: {
        '1': { when: { all: [{ discipline: 'tracking' }, { not: { arrivedFrom: 63 } }] } },
        '3': { when: { not: { arrivedFrom: 63 } } },
      },
    },
  },
};
const book = buildEngineBook(imported, rules);

const hero = (o: Partial<Character> = {}): Character => ({
  combatSkill: 15,
  baseEndurance: 25,
  endurance: 25,
  disciplines: [],
  weaponskill: null,
  weapons: ['axe'],
  backpack: ['meal'],
  specialItems: [],
  gold: 10,
  hasBackpack: true,
  ...o,
});
const at = (section: number, o: Partial<Character> = {}, seed = 1) => startAt(book, seed, hero(o), section);
const act = (s: GameState, a: Action) => apply(book, s, a);
// The first n 0-9 draws a seed will produce, and the first seed matching a predicate.
const draws = (seed: number, n: number) => {
  const r = seedRng(seed);
  return Array.from({ length: n }, () => draw10(r));
};
const seedWhere = (n: number, ok: (xs: number[]) => boolean) => {
  for (let seed = 0; seed < 200_000; seed++) if (ok(draws(seed, n))) return seed;
  throw new Error('no seed found');
};
const fightOut = (s: GameState) => {
  const events: GameEvent[] = [];
  while (s.phase === 'section' && s.section!.pending?.kind === 'combat') {
    const r = act(s, { type: 'fight' });
    events.push(...r.events);
    s = r.state;
  }
  return { s, events };
};

describe('staged random draws and death (section 21 pattern)', () => {
  const run = (seed: number, rolls: number) => {
    let s = at(20, {}, seed);
    for (let i = 0; i < rolls; i++) s = act(s, { type: 'roll' }).state;
    return s;
  };
  it.each([
    ['first draw 5 succeeds with one draw', (x: number[]) => x[0] === 5, 1, [1]],
    ['4 then 8 succeeds with two draws', (x: number[]) => x[0] === 4 && x[1] === 8, 2, [2]],
    ['4, 7, 9 succeeds with three draws', (x: number[]) => x[0] === 4 && x[1] === 7 && x[2] === 9, 3, [3]],
  ])('%s', (_, pattern, rolls, choices) => {
    const s = run(seedWhere(3, pattern), rolls);
    expect(s.section!.draws).toHaveLength(rolls);
    expect(s.section!.pending).toEqual({ kind: 'choose' });
    expect(availableChoices(book, s)).toEqual(choices);
  });

  it('4, 7, 8 is death', () => {
    const s = run(seedWhere(3, (x) => x[0] === 4 && x[1] === 7 && x[2] === 8), 3);
    expect(s.phase).toBe('dead');
  });

  it('never satisfies a condition on a draw that was not made', () => {
    const s = run(seedWhere(1, (x) => x[0] === 9), 1);
    expect(s.section!.draws).toEqual([9]);
    expect(availableChoices(book, s)).toEqual([1]);
  });
});

describe('ENDURANCE and COMBAT SKILL effects', () => {
  it('restores to the armour-adjusted maximum and clears fatigue', () => {
    const s = { ...at(1, { endurance: 10, specialItems: ['helmet'] }), fatigue: 5 };
    const after = act(s, { type: 'choose', ordinal: 1 }).state;
    expect(after.character.endurance).toBe(27);
    expect(after.fatigue).toBe(0);
  });

  it('lowers base COMBAT SKILL permanently, into the exported character', () => {
    const s = at(22);
    expect(s.character.combatSkill).toBe(14);
    const won = act(s, { type: 'choose', ordinal: 1 }).state;
    expect(exportCharacter(book, won)).toMatchObject({ version: 2, combatSkill: 14, hasBackpack: true });
  });
});

describe('bulk and container losses', () => {
  it('clears whole slots, keeping gold and Special Items', () => {
    const s = at(23, { weapons: ['axe', 'sword'], backpack: ['meal', 'meal', 'rope'], specialItems: ['helmet'], endurance: 27 });
    expect(s.character).toMatchObject({ weapons: [], backpack: [], specialItems: ['helmet'], gold: 10, endurance: 27 });
  });

  it('loses the Backpack itself: no Backpack Items until it is replaced, Hunting still feeds', () => {
    const s = at(24, { backpack: ['meal', 'rope'] });
    expect(s.character).toMatchObject({ backpack: [], hasBackpack: false });
    const offered = availableActions(book, s);
    expect(offered).toContainEqual({ type: 'take', item: 'sword' });
    expect(offered).not.toContainEqual({ type: 'take', item: 'meal' });
    expect(act(s, { type: 'continue' }).state.character.endurance).toBe(22);
    const hunter = at(24, { disciplines: ['hunting'] });
    expect(act(hunter, { type: 'continue' }).state.character.endurance).toBe(25);
  });
});

describe('theft (Barry: a random carried copy)', () => {
  it('removes exactly one copy, chosen by the seeded RNG', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const pack = ['meal', 'rope', 'rope'];
      const s = at(25, { backpack: pack }, seed);
      const expected = pack[drawBelow(seedRng(seed), pack.length)]!;
      const left = [...pack];
      left.splice(left.indexOf(expected), 1);
      expect(s.character.backpack).toEqual(left);
      seen.add(expected);
    }
    expect(seen).toEqual(new Set(['meal', 'rope']));
  });

  it('falls back to a Weapon when the Backpack is empty or gone, and takes nothing when both are empty', () => {
    expect(at(25, { backpack: [] }).character.weapons).toEqual([]);
    expect(at(25, { backpack: [], hasBackpack: false }).character.weapons).toEqual([]);
    const none = at(25, { backpack: [], weapons: [] }, 7);
    expect(none.character).toMatchObject({ backpack: [], weapons: [] });
    expect(none.rng).toEqual(seedRng(7));
  });

  it('rejects values at or above the limit and accepts the one just below it', () => {
    for (const n of [3, 7]) {
      const limit = 0x100000000 - (0x100000000 % n);
      for (const first of [limit, 0xffffffff]) {
        const state: RngState = [first, 0, 0, 0];
        const replica: RngState = [first, 0, 0, 0];
        expect(nextU32(replica)).toBe(first);
        const second = nextU32(replica);
        expect(drawBelow(state, n)).toBe(second % n);
        expect(state).toEqual(replica); // exactly two values consumed
      }
      const accepted: RngState = [limit - 1, 0, 0, 0];
      expect(drawBelow(accepted, n)).toBe((limit - 1) % n);
      expect(accepted).toEqual((() => {
        const r: RngState = [limit - 1, 0, 0, 0];
        nextU32(r);
        return r;
      })());
    }
  });

  it('draws without bias below n', () => {
    expect(() => drawBelow(seedRng(1), 0)).toThrow(RangeError);
    const r = seedRng(3);
    expect(Array.from({ length: 50 }, () => drawBelow(r, 1)).every((x) => x === 0)).toBe(true);
    for (const n of [3, 7]) {
      const counts = new Array(n).fill(0);
      const rng = seedRng(n);
      for (let i = 0; i < 70_000; i++) counts[drawBelow(rng, n)]++;
      for (const k of counts) expect(Math.abs(k - 70_000 / n)).toBeLessThan(600);
    }
  });
});

describe('optional gold', () => {
  it('can be taken (capped at 50, once) or declined, and found Meals feed you', () => {
    const s = at(26, { gold: 20, backpack: [] });
    expect(availableActions(book, s)).toContainEqual({ type: 'takeGold' });
    const taken = act(s, { type: 'takeGold' }).state;
    expect(taken.character.gold).toBe(50);
    expect(availableActions(book, taken)).not.toContainEqual({ type: 'takeGold' });
    const fed = act(act(taken, { type: 'take', item: 'meal' }).state, { type: 'continue' });
    expect(fed.events).toContainEqual({ type: 'meal', outcome: 'ate', item: 'meal' });
    expect(act(s, { type: 'continue' }).state.character.gold).toBe(20);
  });
});

describe('combat branches', () => {
  // Ratio >= 11: rolls 1-6 wound Lone Wolf, 7-9 and 0 do not; this enemy always falls in round 1.
  it('leaves through the damage branch before victory counts, applying its effects once without Healing', () => {
    const s = at(27, { disciplines: ['healing'], endurance: 20 }, seedWhere(1, (x) => x[0]! >= 1 && x[0]! <= 6));
    const { state, events } = act(s, { type: 'fight' });
    expect(events.some((e) => e.type === 'enemyDefeated')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'combatEnded', reason: 'heroLoss', to: 40 }));
    expect(state.section!.number).toBe(40);
    expect(state.phase).toBe('section');
    expect(state.character.gold).toBe(9);
    expect(events.some((e) => e.type === 'endurance' && e.cause === 'healing')).toBe(false);
  });

  it('counts an unwounded win as a victory, offering only the ordinary choice', () => {
    const s = at(27, {}, seedWhere(1, (x) => [7, 8, 9, 0].includes(x[0]!)));
    const won = act(s, { type: 'fight' }).state;
    expect(won.section!.number).toBe(27);
    expect(availableChoices(book, won)).toEqual([1]);
  });

  it('puts the damage branch ahead of both victory and the round limit on the same round', () => {
    const s = at(33, {}, seedWhere(1, (x) => x[0]! >= 1 && x[0]! <= 6));
    expect(act(s, { type: 'fight' }).state.section!.number).toBe(40);
  });

  it('times out after the round limit, opens evasion from round 2, and lets an escape on the limit round escape', () => {
    let s = at(28, { endurance: 40 });
    expect(availableActions(book, s)).not.toContainEqual({ type: 'evade' });
    s = act(s, { type: 'fight' }).state;
    expect(availableActions(book, s)).not.toContainEqual({ type: 'evade' });
    s = act(s, { type: 'fight' }).state;
    expect(availableActions(book, s)).toContainEqual({ type: 'evade' });
    s = act(s, { type: 'fight' }).state;
    const escaped = act(s, { type: 'evade' });
    expect(escaped.state.section!.number).toBe(42);
    expect(escaped.events.some((e) => e.type === 'combatEnded')).toBe(false);
    const timedOut = act(s, { type: 'fight' });
    expect(timedOut.state.section!.number).toBe(41);
    expect(timedOut.events).toContainEqual(expect.objectContaining({ type: 'combatEnded', reason: 'timeout' }));
  });

  it('settles a limited fight as a win, a death or a timeout, never offering both win and timeout', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const { s } = fightOut(at(34, { endurance: 12 }, seed));
      if (s.phase === 'dead') outcomes.add('death');
      else if (s.section!.number === 41) outcomes.add('timeout');
      else {
        expect(s.section!.rounds!).toBeLessThanOrEqual(4);
        expect(availableChoices(book, s)).toEqual([1]);
        outcomes.add(s.section!.rounds === 4 ? 'win on the limit round' : 'win');
      }
    }
    expect(outcomes).toEqual(new Set(['win', 'win on the limit round', 'death', 'timeout']));
  });
});

describe('arrival-dependent choices (the 214 -> 125 pattern)', () => {
  const tracker = { disciplines: ['tracking' as const] };
  it('offers only the second exit straight after arriving from 63, even with Tracking', () => {
    const s = act(at(63, tracker), { type: 'choose', ordinal: 1 }).state;
    expect(s.section).toMatchObject({ number: 60, from: 63 });
    expect(availableChoices(book, s)).toEqual([2]);
  });

  it('offers every route the text permits on any other arrival', () => {
    expect(at(60, tracker).section!.from).toBeNull();
    expect(availableChoices(book, at(60, tracker))).toEqual([1, 2, 3]);
  });

  it('expires on the next move, so an earlier visit to 63 does not restrict a later arrival', () => {
    let s = act(at(63, tracker), { type: 'choose', ordinal: 1 }).state;
    s = act(s, { type: 'choose', ordinal: 2 }).state;
    s = act(s, { type: 'choose', ordinal: 2 }).state;
    expect(s.section).toMatchObject({ number: 60, from: 62 });
    expect(s.visited).toContain(63);
    expect(availableChoices(book, s)).toEqual([1, 2, 3]);
  });

  it('survives serialisation', () => {
    const s = act(at(63, tracker), { type: 'choose', ordinal: 1 }).state;
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(copy.section!.from).toBe(63);
    expect(availableChoices(book, copy)).toEqual([2]);
  });
});

describe('a replacement Backpack (the section 20 pattern)', () => {
  it('lets someone without a Backpack take it once, and then carry the Meals', () => {
    let s = at(70, { backpack: [], hasBackpack: false });
    const offered = availableActions(book, s);
    expect(offered).toContainEqual({ type: 'takeBackpack' });
    expect(offered).not.toContainEqual({ type: 'take', item: 'meal' });
    expect(offered).toContainEqual({ type: 'take', item: 'sword' });
    const taken = act(s, { type: 'takeBackpack' });
    expect(taken.events).toContainEqual({ type: 'backpackGained' });
    s = taken.state;
    expect(s.character.hasBackpack).toBe(true);
    expect(() => act(s, { type: 'takeBackpack' })).toThrow(/not available/);
    s = act(act(s, { type: 'take', item: 'meal' }).state, { type: 'take', item: 'meal' }).state;
    expect(s.character.backpack).toEqual(['meal', 'meal']);
  });

  it('leaves the Meals behind if the Backpack is declined, and is inert for someone who has one', () => {
    const declined = act(at(70, { backpack: [], hasBackpack: false }), { type: 'continue' }).state;
    expect(declined.character).toMatchObject({ hasBackpack: false, backpack: [] });
    expect(availableActions(book, at(70))).not.toContainEqual({ type: 'takeBackpack' });
  });
});

describe('losing one item of the player\'s choice (the section 277 pattern)', () => {
  it('waits for the choice when different weapons are carried, and nothing else bypasses it', () => {
    const s = at(71, { weapons: ['axe', 'sword'] });
    expect(availableActions(book, s)).toEqual([
      { type: 'loseItem', item: 'axe' },
      { type: 'loseItem', item: 'sword' },
    ]);
    const after = act(s, { type: 'loseItem', item: 'sword' }).state;
    expect(after.character).toMatchObject({ weapons: ['axe'], backpack: ['meal'], gold: 10, hasBackpack: true });
    expect(after.section!.pending).toEqual({ kind: 'choose' });
  });

  it('loses one copy automatically when only one kind is carried, and skips an empty slot', () => {
    expect(at(71, { weapons: ['sword', 'sword'] }).character.weapons).toEqual(['sword']);
    const none = at(71, { weapons: [] }, 9);
    expect(none.section!.pending).toEqual({ kind: 'choose' });
    expect(none.rng).toEqual(seedRng(9));
  });
});

describe('inventory conditions (the section 247 pattern)', () => {
  it('count carried copies in a slot, and nothing for a lost Backpack', () => {
    expect(availableChoices(book, at(72, { backpack: [] }))).toEqual([2]);
    expect(availableChoices(book, at(72, { backpack: ['rope'], hasBackpack: false }))).toEqual([2]);
    expect(availableChoices(book, at(72, { backpack: ['rope'] }))).toEqual([1, 2]);
    const twoOrThree = { inventory: { slot: 'backpack' as const, min: 2, max: 3 } };
    expect(holds(book, at(72, { backpack: ['meal', 'meal'] }), twoOrThree)).toBe(true);
    expect(holds(book, at(72, { backpack: ['meal', 'meal', 'rope', 'rope'] }), twoOrThree)).toBe(false);
  });
});

describe('first-round and later-round modifiers (the section 283 pattern)', () => {
  it('apply +2 to the first round only, then -2 unless Mindshield', () => {
    const skills = (o: Partial<Character>) => {
      let s = at(73, { endurance: 40, ...o });
      const out: number[] = [];
      for (let i = 0; i < 3; i++) {
        const r = act(s, { type: 'fight' });
        out.push(...r.events.flatMap((e) => (e.type === 'combatRound' ? [e.combatSkill] : [])));
        s = r.state;
      }
      return out;
    };
    expect(skills({})).toEqual([17, 13, 13]);
    expect(skills({ disciplines: ['mindshield'] })).toEqual([17, 15, 15]);
  });
});

describe('meals and usable items', () => {
  it('lets the player choose which Meal to eat; a healing Meal also restores ENDURANCE', () => {
    const s = at(29, { backpack: ['meal', 'laumspur'], endurance: 20 });
    expect(availableActions(book, s)).toEqual([
      { type: 'eat', item: 'meal' },
      { type: 'eat', item: 'laumspur' },
    ]);
    const ate = act(s, { type: 'eat', item: 'laumspur' }).state;
    expect(ate.character).toMatchObject({ backpack: ['meal'], endurance: 23 });
    expect(ate.section!.pending).toEqual({ kind: 'choose' });
  });

  it('eats automatically when only one kind of Meal is carried', () => {
    const s = at(29, { backpack: ['laumspur', 'laumspur'], endurance: 20 });
    expect(s.character).toMatchObject({ backpack: ['laumspur'], endurance: 23 });
  });

  it('does not count using a herb outside a meal as eating', () => {
    let s = at(1, { backpack: ['laumspur'], endurance: 20 });
    s = act(s, { type: 'use', item: 'laumspur' }).state;
    expect(s.character.endurance).toBe(23);
    s = act(s, { type: 'choose', ordinal: 2 }).state;
    expect(s.character.endurance).toBe(20);
  });

  it('allows a herb between combat rounds, but not the Healing Potion', () => {
    let s = at(32, { backpack: ['laumspur', 'potion'], endurance: 10 });
    s = act(s, { type: 'fight' }).state;
    const options = availableActions(book, s);
    expect(options).toContainEqual({ type: 'use', item: 'laumspur' });
    expect(options).not.toContainEqual({ type: 'use', item: 'potion' });
    const rounds = (s.section!.pending as { rounds: number }).rounds;
    const healed = act(s, { type: 'use', item: 'laumspur' }).state;
    expect(healed.character.endurance).toBe(s.character.endurance + 3);
    expect((healed.section!.pending as { rounds: number }).rounds).toBe(rounds);
  });
});

describe('saves and validation', () => {
  it('replay random play through every extension exactly, within all limits', () => {
    for (let seed = 0; seed < 150; seed++) {
      let x = seed * 2654435761;
      const pick = <T>(xs: T[]) => {
        x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
        return xs[(x >>> 0) % xs.length]!;
      };
      const start = [20, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 70, 71, 72][seed % 14]!;
      const hasBackpack = seed % 3 > 0;
      const kit = { backpack: hasBackpack ? ['meal', 'laumspur', 'potion', 'rope'] : [], weapons: ['axe', 'sword'], endurance: 15, hasBackpack };
      let s = at(start, kit, seed);
      const actions: Action[] = [];
      for (let i = 0; i < 60 && availableActions(book, s).length; i++) {
        const a = pick(availableActions(book, s));
        actions.push(a);
        s = act(s, a).state;
        const ch = s.character;
        expect(ch.gold).toBeLessThanOrEqual(50);
        expect(ch.backpack.length).toBeLessThanOrEqual(8);
        expect(ch.endurance).toBeLessThanOrEqual(maxEndurance(book, ch));
        expect(s.fatigue).toBeLessThanOrEqual(maxEndurance(book, ch) - ch.endurance);
        if (!ch.hasBackpack) expect(ch.backpack).toEqual([]);
      }
      // Replay from a save made at the same start: rebuild via startAt plus the same actions.
      let again = at(start, kit, seed);
      for (const a of actions) again = act(again, a).state;
      expect(again).toEqual(s);
    }
  });

  it('accept the new actions in saves', () => {
    const save = { ...newSave(book, 1), actions: [{ type: 'takeGold' }, { type: 'eat', item: 'meal' }] };
    expect(() => replay(book, save)).toThrow(/not available/);
  });

  it.each([
    ['a damage-branch choice that does not exist', (r: any) => (r.sections['27'].effects[0].onHeroLoss.choice = 9), /onHeroLoss choice 9/],
    ['a round limit without a timeout', (r: any) => delete r.sections['28'].effects[0].timeout, /maxRounds and timeout/],
    ['a pickup offering nothing', (r: any) => (r.sections['26'].effects[0] = { op: 'pickup' }), /at least one item, some gold or a Backpack/],
    ['a draw index of 0', (r: any) => (r.sections['20'].choices['1'].when.random.draw = 0), /draw|too small/i],
  ])('rejects %s', (_, patch, message) => {
    const r = JSON.parse(JSON.stringify(rules));
    patch(r);
    expect(() => buildEngineBook(imported, r)).toThrow(message);
  });
});
