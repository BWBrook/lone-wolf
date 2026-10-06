import { describe, expect, it } from 'vitest';
import {
  apply,
  availableActions,
  availableChoices,
  combatResult,
  heroCombatSkill,
  startAt,
  type Action,
  type CombatEffect,
  type GameEvent,
  type GameState,
} from '../../src/engine';
import { book, character } from './fixture';

const act = (s: GameState, a: Action) => apply(book, s, a);
const base: CombatEffect = { op: 'combat', combat: 0 };

describe('combat skill in a fight', () => {
  const cs = (overrides: Parameters<typeof character>[0], effect: CombatEffect = base) =>
    heroCombatSkill(book, startAt(book, 1, character(overrides), 2), effect);

  it('adds Mindblast unless the enemy is immune', () => {
    const mindblast = { disciplines: ['mindblast' as const] };
    expect(cs(mindblast)).toBe(17);
    expect(cs(mindblast, { ...base, mindblastImmune: true })).toBe(15);
  });

  it('adds Weaponskill only when carrying that weapon', () => {
    const skilled = { disciplines: ['weaponskill' as const], weaponskill: 'sword' as const };
    expect(cs({ ...skilled, weapons: ['axe'] })).toBe(15);
    expect(cs({ ...skilled, weapons: ['axe', 'sword'] })).toBe(17);
  });

  it('deducts 4 when unarmed, by circumstance or by the text', () => {
    expect(cs({ weapons: [] })).toBe(11);
    expect(cs({}, { ...base, unarmed: true })).toBe(11);
    expect(cs({ disciplines: ['weaponskill'], weaponskill: 'axe' }, { ...base, unarmed: true })).toBe(11);
  });

  it('applies conditional modifiers', () => {
    const effect: CombatEffect = { ...base, modifiers: [{ combatSkill: -2, when: { not: { discipline: 'mindshield' } } }] };
    expect(cs({}, effect)).toBe(13);
    expect(cs({ disciplines: ['mindshield'] }, effect)).toBe(15);
  });
});

describe('combat rounds', () => {
  it('resolves every round from the CRT until someone dies, then unlocks the win choice', () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = startAt(book, seed, character(), 2);
      const events: GameEvent[] = [];
      expect(availableActions(book, s)).toEqual([{ type: 'fight' }]);
      while (s.phase === 'section' && s.section!.pending!.kind === 'combat') {
        const r = act(s, { type: 'fight' });
        events.push(...r.events);
        s = r.state;
      }
      let enemy = 8;
      let hero = 25;
      events.forEach((e, i) => {
        if (e.type !== 'combatRound') return;
        const roll = events[i - 1] as { type: string; value: number };
        expect(roll.type).toBe('rolled');
        const [eLoss, hLoss] = combatResult(e.ratio, roll.value);
        expect(e.ratio).toBe(3);
        enemy = eLoss === 'k' ? 0 : Math.max(0, enemy - eLoss);
        hero = hLoss === 'k' ? 0 : Math.max(0, hero - hLoss);
        expect(e.enemyEndurance).toBe(enemy);
      });
      expect(s.character.endurance).toBe(hero);
      if (s.phase === 'section') {
        expect(enemy).toBe(0);
        expect(availableChoices(book, s)).toEqual([1]); // the evade choice is never a normal choice
      } else {
        expect(s.phase).toBe('dead');
      }
    }
  });

  it('allows evasion only after the required rounds, and only the hero takes damage that round', () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = startAt(book, seed, character({ endurance: 20 }), 2);
      expect(() => act(s, { type: 'evade' })).toThrow();
      s = act(s, { type: 'fight' }).state;
      if (s.phase !== 'section' || s.section!.pending?.kind !== 'combat') continue;
      const enemyBefore = (s.section!.pending as { enemyEndurance: number }).enemyEndurance;
      const { state, events } = act(s, { type: 'evade' });
      const round = events.find((e) => e.type === 'combatRound')!;
      expect(round).toMatchObject({ evading: true, enemyLoss: 0, enemyEndurance: enemyBefore });
      if (state.phase === 'section') {
        expect(state.section!.number).toBe(6);
        expect(events.some((e) => e.type === 'endurance' && e.cause === 'healing')).toBe(false);
      }
    }
  });

  it("applies the evade choice's own conditions and effects", () => {
    expect(availableActions(book, startAt(book, 1, character({ gold: 0 }), 12))).toEqual([{ type: 'fight' }]);
    const s = startAt(book, 1, character({ gold: 10 }), 12);
    expect(availableActions(book, s)).toContainEqual({ type: 'evade' });
    const { state, events } = act(s, { type: 'evade' });
    expect(events.some((e) => e.type === 'combatRound')).toBe(false); // no round fought yet
    expect(state.character.gold).toBe(5);
    expect(state.section!.number).toBe(6);
  });

  it('ends the adventure when the hero is killed', () => {
    let s = startAt(book, 3, character({ combatSkill: 10, endurance: 2 }), 11);
    s = act(s, { type: 'continue' }).state;
    while (s.phase === 'section') s = act(s, { type: 'fight' }).state;
    expect(s.phase).toBe('dead');
    expect(s.character.endurance).toBe(0);
    expect(availableActions(book, s)).toEqual([]);
  });
});
