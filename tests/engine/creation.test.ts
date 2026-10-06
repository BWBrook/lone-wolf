import { describe, expect, it } from 'vitest';
import { apply, availableActions, maxEndurance, newGame, type Action, type Discipline, type GameState } from '../../src/engine';
import { book } from './fixture';

const act = (s: GameState, a: Action) => apply(book, s, a);
const FIVE: Discipline[] = ['camouflage', 'hunting', 'sixthSense', 'tracking', 'healing'];

function create(seed: number, disciplines: Discipline[] = FIVE) {
  let s = act(newGame(seed), { type: 'rollStats' }).state;
  for (const discipline of disciplines) s = act(s, { type: 'learn', discipline }).state;
  if (s.phase === 'weaponskill') s = act(s, { type: 'rollWeaponskill' }).state;
  return act(s, { type: 'rollEquipment' });
}

describe('character creation', () => {
  it('rolls COMBAT SKILL 10-19 and ENDURANCE 20-29', () => {
    for (let seed = 0; seed < 200; seed++) {
      const c = act(newGame(seed), { type: 'rollStats' }).state.character;
      expect(c.combatSkill).toBeGreaterThanOrEqual(10);
      expect(c.combatSkill).toBeLessThanOrEqual(19);
      expect(c.baseEndurance).toBeGreaterThanOrEqual(20);
      expect(c.baseEndurance).toBeLessThanOrEqual(29);
      expect(c.endurance).toBe(c.baseEndurance);
    }
  });

  it('offers only disciplines not yet learnt, five in all', () => {
    let s = act(newGame(1), { type: 'rollStats' }).state;
    s = act(s, { type: 'learn', discipline: 'hunting' }).state;
    expect(availableActions(book, s)).toHaveLength(9);
    expect(() => act(s, { type: 'learn', discipline: 'hunting' })).toThrow();
  });

  it('rolls a weaponskill weapon only when Weaponskill is learnt', () => {
    expect(create(1).state.character.weaponskill).toBeNull();
    const kinds = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      kinds.add(create(seed, ['weaponskill', ...FIVE.slice(1)]).state.character.weaponskill!);
    }
    expect(kinds.size).toBe(9); // 0-9 maps to nine kinds: Sword appears twice
  });

  it('issues the starting kit, gold and one random item, then enters section 1', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { state, events } = create(seed);
      const c = state.character;
      expect(state.phase).toBe('section');
      expect(state.section?.number).toBe(1);
      expect(c.weapons).toContain('axe');
      expect(c.backpack).toContain('meal');
      expect(c.specialItems).toContain('map');
      const gold = events.find((e) => e.type === 'rolled' && e.purpose === 'gold')!;
      const item = events.find((e) => e.type === 'rolled' && e.purpose === 'equipment')!;
      expect(c.gold).toBe((gold as { value: number }).value + ((item as { value: number }).value === 9 ? 12 : 0));
      if ((item as { value: number }).value === 2) {
        expect(c.endurance).toBe(c.baseEndurance + 2);
        expect(maxEndurance(book, c)).toBe(c.baseEndurance + 2);
      }
    }
  });
});
