import { describe, expect, it } from 'vitest';
import {
  apply,
  availableActions,
  availableChoices,
  buildEngineBook,
  maxEndurance,
  startAt,
  type Action,
  type GameState,
} from '../../src/engine';
import { book, character, imported, rules } from './fixture';

const act = (s: GameState, a: Action) => apply(book, s, a);
const at = (section: number, overrides: Parameters<typeof character>[0] = {}, seed = 1) =>
  startAt(book, seed, character(overrides), section);
const kinds = (s: GameState) => availableActions(book, s).map((a) => a.type);

describe('choices', () => {
  it('are gated by disciplines and items', () => {
    expect(availableChoices(book, at(1, { disciplines: [] }))).toEqual([1, 4]);
    expect(availableChoices(book, at(1))).toEqual([1, 2, 4]);
    expect(availableChoices(book, at(1, { specialItems: ['key'] }))).toEqual([1, 2, 3, 4]);
  });

  it('charge gold when taken, and are hidden when unaffordable', () => {
    const s = act(at(8, { gold: 10 }), { type: 'choose', ordinal: 1 }).state;
    expect(s.character.gold).toBe(5);
    expect(s.phase).toBe('won');
    expect(availableChoices(book, at(8, { gold: 3 }))).toEqual([2]);
  });

  it('follow a random draw with discipline modifiers', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = at(5, {}, seed);
      expect(kinds(s)).toContain('roll');
      expect(availableChoices(book, s)).toEqual([]);
      const { state, events } = act(s, { type: 'roll' });
      const roll = events.find((e) => e.type === 'rolled')!;
      expect(roll).toMatchObject({ purpose: 'section', total: (roll as { value: number }).value + 2 });
      expect(availableChoices(book, state)).toEqual([(roll as { total: number }).total <= 4 ? 1 : 2]);
    }
  });

  it('end in death at a dead end and in victory at the final section', () => {
    expect(at(7).phase).toBe('dead');
    expect(at(9).phase).toBe('won');
  });
});

describe('meals', () => {
  it('feed a hunter for free, else consume a Meal, else cost 3 ENDURANCE', () => {
    const hunter = act(at(1), { type: 'choose', ordinal: 2 });
    expect(hunter.state.section?.number).toBe(3);
    expect(hunter.events).toContainEqual({ type: 'meal', outcome: 'hunted' });
    expect(hunter.state.character.backpack).toEqual(['meal']);

    const eater = at(3, { disciplines: [] });
    expect(eater.character.backpack).toEqual([]);
    expect(eater.character.endurance).toBe(25);

    const starving = at(3, { disciplines: [], backpack: [] });
    expect(starving.character.endurance).toBe(22);
  });

  it('cannot be hunted where the text forbids it', () => {
    expect(at(10).character.backpack).toEqual([]);
    expect(at(10, { backpack: [] }).character.endurance).toBe(22);
  });
});

describe('healing', () => {
  it('restores 1 ENDURANCE on leaving a section without combat, only with Healing and below the maximum', () => {
    expect(act(at(4, { endurance: 20 }), { type: 'continue' }).state.character.endurance).toBe(20);
    const leave = (o: Parameters<typeof character>[0]) =>
      act(act(at(4, o), { type: 'continue' }).state, { type: 'choose', ordinal: 1 }).state.character.endurance;
    expect(leave({ endurance: 20 })).toBe(21);
    expect(leave({ endurance: 25 })).toBe(25);
    expect(leave({ endurance: 20, disciplines: [] })).toBe(20);
  });
});

// Readers' Handbook ruling adopted by Barry: Healing restores wounds, not losses
// from hunger or fatigue.
describe('healing after hunger and fatigue', () => {
  const healer = { disciplines: ['healing' as const] };
  const leave = (s: GameState) => act(s, { type: 'choose', ordinal: 1 }).state;

  it('does not restore ENDURANCE lost to hunger', () => {
    const s = at(3, { ...healer, backpack: [] });
    expect(s.character.endurance).toBe(22);
    expect(s.fatigue).toBe(3);
    expect(leave(s).character.endurance).toBe(22);
  });

  it('restores wounds even while some loss is from hunger', () => {
    const s = at(3, { ...healer, backpack: [], endurance: 20 });
    expect(s.character.endurance).toBe(17);
    expect(leave(s).character.endurance).toBe(18);
  });

  it('does not restore losses the rules mark as fatigue', () => {
    const r = JSON.parse(JSON.stringify(rules));
    r.sections['6'].effects[0].fatigue = true;
    const tired = buildEngineBook(imported, r);
    const s = startAt(tired, 1, character(healer), 6);
    expect(s.character.endurance).toBe(23);
    expect(apply(tired, s, { type: 'choose', ordinal: 1 }).state.character.endurance).toBe(23);
    expect(leave(at(6, healer)).character.endurance).toBe(24);
  });

  it('lets other restoratives clear hunger first, so Healing can mend what remains', () => {
    let s = at(3, { ...healer, backpack: ['potion'], endurance: 20 });
    expect([s.character.endurance, s.fatigue]).toEqual([17, 3]);
    s = act(s, { type: 'use', item: 'potion' }).state;
    expect([s.character.endurance, s.fatigue]).toEqual([21, 0]);
    expect(leave(s).character.endurance).toBe(22);
  });
});

describe('items', () => {
  it('can be taken only within carrying limits, and dropped to make room', () => {
    let s = at(4, { weapons: ['axe', 'dagger'] });
    expect(availableActions(book, s)).not.toContainEqual({ type: 'take', item: 'sword' });
    s = act(s, { type: 'drop', item: 'dagger' }).state;
    s = act(s, { type: 'take', item: 'sword' }).state;
    s = act(s, { type: 'take', item: 'key' }).state;
    expect(s.character.weapons).toEqual(['axe', 'sword']);
    expect(s.character.specialItems).toEqual(['map', 'key']);
    expect(at(4, { backpack: Array(8).fill('meal') }).character.backpack).toHaveLength(8);
    expect(availableActions(book, at(4, { backpack: Array(8).fill('meal') }))).not.toContainEqual({
      type: 'take',
      item: 'potion',
    });
  });

  it('raise and lower maximum ENDURANCE when special items are gained or lost', () => {
    const s = at(6, { specialItems: ['helmet'], baseEndurance: 25, endurance: 27, disciplines: ['mindshield'] });
    expect(s.character.endurance).toBe(27);
    expect(act(s, { type: 'drop', item: 'helmet' }).state.character.endurance).toBe(25);
  });

  it('count an armour bonus once however many copies are carried', () => {
    let s = at(4, { specialItems: ['map', 'helmet'], baseEndurance: 25, endurance: 27 });
    s = act(s, { type: 'take', item: 'helmet' }).state;
    expect(s.character.specialItems).toEqual(['map', 'helmet', 'helmet']);
    expect(s.character.endurance).toBe(27);
    expect(maxEndurance(book, s.character)).toBe(27);
    s = act(s, { type: 'drop', item: 'helmet' }).state;
    expect(s.character.endurance).toBe(27);
    s = act(s, { type: 'drop', item: 'helmet' }).state;
    expect(s.character.endurance).toBe(25);
  });

  it('heal with a potion outside combat, but not before a combat in the same section', () => {
    const before = at(11, { backpack: ['potion'], endurance: 15 });
    expect(kinds(before)).not.toContain('use');
    const after = at(6, { backpack: ['potion'], endurance: 15, disciplines: ['mindshield'] });
    const used = act(after, { type: 'use', item: 'potion' }).state;
    expect(used.character.endurance).toBe(19);
    expect(used.character.backpack).toEqual([]);
    expect(kinds(at(6, { backpack: ['potion'], disciplines: ['mindshield'] }))).not.toContain('use');
  });
});

describe('conditional effects', () => {
  it('are skipped when their condition fails', () => {
    expect(at(6).character.endurance).toBe(23);
    expect(at(6, { disciplines: ['mindshield'] }).character.endurance).toBe(25);
  });
});
