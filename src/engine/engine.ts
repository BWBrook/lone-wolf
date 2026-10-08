import { combatResult } from './crt';
import { draw10, drawBelow, seedRng } from './rng';
import { DISCIPLINES, type AutoEffect, type CombatEffect, type Condition, type Range, type WeaponKind } from './rules';
import type {
  Action,
  Character,
  CharacterRecord,
  EngineBook,
  EngineSection,
  GameEvent,
  GameState,
  ItemId,
  RollPurpose,
} from './types';

const WEAPONSKILL_TABLE: readonly WeaponKind[] = [
  'dagger',
  'spear',
  'mace',
  'shortSword',
  'warhammer',
  'sword',
  'axe',
  'sword',
  'quarterstaff',
  'broadsword',
];
const MAX_WEAPONS = 2;
const MAX_BACKPACK = 8;
const MAX_GOLD = 50;
const HUNGER_LOSS = 3;

export class IllegalAction extends Error {}

export function newGame(seed: number): GameState {
  return {
    version: 1,
    rng: seedRng(seed),
    phase: 'stats',
    character: {
      combatSkill: 0,
      baseEndurance: 0,
      endurance: 0,
      disciplines: [],
      weaponskill: null,
      weapons: [],
      backpack: [],
      specialItems: [],
      gold: 0,
      hasBackpack: true,
    },
    section: null,
    visited: [],
    fatigue: 0,
  };
}

// Begin play at a section with a given character: for tests, dev tools and, later,
// starting a book with a carried-over character.
export function startAt(book: EngineBook, seed: number, character: Character, section = 1): GameState {
  const s = newGame(seed);
  s.character = JSON.parse(JSON.stringify(character));
  s.phase = 'section';
  const ev: GameEvent[] = [];
  enterSection(s, ev, section);
  advance(book, s, ev);
  return s;
}

export function maxEndurance(book: EngineBook, c: Character): number {
  let max = c.baseEndurance;
  for (const id of new Set(c.specialItems)) {
    const def = book.items[id];
    if (def?.slot === 'special') max += def.endurance ?? 0;
  }
  return max;
}

export function heroCombatSkill(book: EngineBook, s: GameState, e: CombatEffect): number {
  const c = s.character;
  let cs = c.combatSkill;
  if (c.disciplines.includes('mindblast') && !e.mindblastImmune) cs += 2;
  if (e.unarmed || c.weapons.length === 0) cs -= 4;
  else if (c.weaponskill && c.weapons.some((w) => weaponKind(book, w) === c.weaponskill)) cs += 2;
  for (const m of e.modifiers ?? []) if (!m.when || holds(book, s, m.when)) cs += m.combatSkill;
  return cs;
}

export function holds(book: EngineBook, s: GameState, cond: Condition): boolean {
  const c = s.character;
  if ('discipline' in cond) return c.disciplines.includes(cond.discipline);
  if ('item' in cond) return carried(c).includes(cond.item);
  if ('gold' in cond) return inRange(c.gold, cond.gold);
  if ('endurance' in cond) return inRange(c.endurance, cond.endurance);
  if ('random' in cond) {
    const draws = s.section?.draws ?? [];
    const value = cond.random.draw === undefined ? draws.at(-1) : draws[cond.random.draw - 1];
    return value !== undefined && inRange(value, cond.random);
  }
  if ('rounds' in cond) return s.section?.rounds != null && inRange(s.section.rounds, cond.rounds);
  if ('visited' in cond) return s.visited.includes(cond.visited);
  if ('arrivedFrom' in cond) return s.section?.from === cond.arrivedFrom;
  if ('not' in cond) return !holds(book, s, cond.not);
  if ('all' in cond) return cond.all.every((x) => holds(book, s, x));
  return cond.any.some((x) => holds(book, s, x));
}

export function availableActions(book: EngineBook, s: GameState): Action[] {
  const c = s.character;
  switch (s.phase) {
    case 'stats':
      return [{ type: 'rollStats' }];
    case 'disciplines':
      return DISCIPLINES.filter((d) => !c.disciplines.includes(d)).map((discipline) => ({ type: 'learn', discipline }));
    case 'weaponskill':
      return [{ type: 'rollWeaponskill' }];
    case 'equipment':
      return [{ type: 'rollEquipment' }];
    case 'dead':
    case 'won':
      return [];
    case 'section':
      return sectionActions(book, s);
  }
}

function sectionActions(book: EngineBook, s: GameState): Action[] {
  const sec = s.section!;
  const pending = sec.pending!;
  const c = s.character;
  const usable = unique(c.backpack)
    .filter((item) => canUse(book, s, item))
    .map((item): Action => ({ type: 'use', item }));
  if (pending.kind === 'combat') {
    const e = currentEffect(book, s) as CombatEffect;
    const actions: Action[] = [{ type: 'fight' }];
    if (e.evade && pending.rounds >= e.evade.afterRounds && choiceAllowed(book, s, e.evade.choice)) {
      actions.push({ type: 'evade' });
    }
    return [...actions, ...usable];
  }
  if (pending.kind === 'meal') return pending.options.map((item) => ({ type: 'eat', item }));
  const actions: Action[] = [];
  if (pending.kind === 'pickup') {
    for (const item of unique(pending.offered)) if (hasRoom(book, c, item)) actions.push({ type: 'take', item });
    if (pending.gold > 0) actions.push({ type: 'takeGold' });
    actions.push({ type: 'continue' });
  } else if (pending.kind === 'random') {
    actions.push({ type: 'roll' });
  } else {
    for (const ordinal of availableChoices(book, s)) actions.push({ type: 'choose', ordinal });
  }
  for (const item of unique(carried(c))) actions.push({ type: 'drop', item });
  return [...actions, ...usable];
}

export function availableChoices(book: EngineBook, s: GameState): number[] {
  const def = sectionDef(book, s.section!.number);
  return def.choices
    .filter((ch) => !automaticChoices(def).has(ch.ordinal) && choiceAllowed(book, s, ch.ordinal))
    .map((ch) => ch.ordinal);
}

// Choices reached only from inside a fight (evasion, damage branch, timeout), never offered directly.
export function automaticChoices(def: EngineSection): Set<number> {
  return new Set(
    (def.rules.effects ?? []).flatMap((e) =>
      e.op === 'combat' ? [e.evade?.choice, e.onHeroLoss?.choice, e.timeout?.choice].filter((x) => x !== undefined) : [],
    ),
  );
}

function choiceAllowed(book: EngineBook, s: GameState, ordinal: number): boolean {
  const rule = sectionDef(book, s.section!.number).rules.choices?.[String(ordinal)];
  return !rule?.when || holds(book, s, rule.when);
}

export function apply(book: EngineBook, state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  if (!availableActions(book, state).some((a) => sameAction(a, action))) {
    throw new IllegalAction(`${JSON.stringify(action)} is not available in phase ${state.phase}`);
  }
  const s: GameState = JSON.parse(JSON.stringify(state));
  const ev: GameEvent[] = [];
  const c = s.character;

  switch (action.type) {
    case 'rollStats':
      c.combatSkill = 10 + draw(s, ev, 'combatSkill');
      c.baseEndurance = c.endurance = 20 + draw(s, ev, 'endurance');
      s.phase = 'disciplines';
      break;
    case 'learn':
      c.disciplines.push(action.discipline);
      if (c.disciplines.length === book.setup.disciplines) {
        s.phase = c.disciplines.includes('weaponskill') ? 'weaponskill' : 'equipment';
      }
      break;
    case 'rollWeaponskill':
      c.weaponskill = WEAPONSKILL_TABLE[draw(s, ev, 'weaponskill')]!;
      s.phase = 'equipment';
      break;
    case 'rollEquipment': {
      changeGold(c, ev, book.setup.goldBase + draw(s, ev, 'gold'));
      for (const item of book.setup.items) gain(book, c, ev, item);
      const found = book.setup.randomItem[String(draw(s, ev, 'equipment')) as keyof typeof book.setup.randomItem];
      for (const item of found.items ?? []) gain(book, c, ev, item);
      if (found.gold) changeGold(c, ev, found.gold);
      s.phase = 'section';
      enterSection(s, ev, 1);
      break;
    }
    case 'take': {
      const pending = s.section!.pending as { offered: ItemId[] };
      pending.offered.splice(pending.offered.indexOf(action.item), 1);
      gain(book, c, ev, action.item);
      break;
    }
    case 'takeGold': {
      const pending = s.section!.pending as { gold: number };
      changeGold(c, ev, pending.gold);
      pending.gold = 0;
      break;
    }
    case 'eat':
      consumeMeal(book, s, ev, action.item);
      finishEffect(s);
      break;
    case 'drop':
      lose(book, s, ev, action.item);
      break;
    case 'use': {
      const def = book.items[action.item];
      c.backpack.splice(c.backpack.indexOf(action.item), 1);
      ev.push({ type: 'itemLost', item: action.item });
      if (def?.slot === 'backpack' && def.use) changeEndurance(book, s, ev, def.use.endurance, 'item');
      break;
    }
    case 'continue':
      finishEffect(s);
      break;
    case 'roll': {
      const e = currentEffect(book, s);
      const value = draw(s, ev, 'section');
      let total = value;
      if (e?.op === 'random') for (const m of e.modifiers ?? []) if (holds(book, s, m.when)) total += m.add;
      (ev.at(-1) as { total?: number }).total = total;
      s.section!.draws.push(total);
      finishEffect(s);
      break;
    }
    case 'fight':
      fightRound(book, s, ev, false);
      break;
    case 'evade': {
      const e = currentEffect(book, s) as CombatEffect;
      const pending = s.section!.pending as { rounds: number };
      // The escape round can still kill, or trigger a damage branch, before the escape.
      if (pending.rounds > 0 && !fightRound(book, s, ev, true)) break;
      leaveVia(book, s, ev, e.evade!.choice, (to) => ev.push({ type: 'evaded', to }));
      break;
    }
    case 'choose': {
      const rule = sectionDef(book, s.section!.number).rules.choices?.[String(action.ordinal)];
      for (const e of rule?.effects ?? []) applyAuto(book, s, ev, e);
      if (s.phase !== 'section') break;
      if (!s.section!.hadCombat && c.disciplines.includes('healing')) changeEndurance(book, s, ev, 1, 'healing');
      enterSection(s, ev, choiceTarget(book, s, action.ordinal));
      break;
    }
  }

  advance(book, s, ev);
  return { state: s, events: ev };
}

// Resolve automatic effects until the section needs player input or play ends.
function advance(book: EngineBook, s: GameState, ev: GameEvent[]): void {
  while (s.phase === 'section' && s.section!.pending === null) {
    const sec = s.section!;
    const def = sectionDef(book, sec.number);
    const e = (def.rules.effects ?? [])[sec.effect];
    if (!e) {
      if (sec.number === book.finalSection) {
        s.phase = 'won';
        ev.push({ type: 'won' });
      } else if (def.deadEnd) {
        die(s, ev, 'deadEnd');
      } else {
        sec.pending = { kind: 'choose' };
      }
      return;
    }
    if ('when' in e && e.when && !holds(book, s, e.when)) {
      sec.effect++;
      continue;
    }
    switch (e.op) {
      case 'endurance':
      case 'gold':
      case 'lose':
        applyAuto(book, s, ev, e);
        sec.effect++;
        break;
      case 'meal':
        if (startMeal(book, s, ev, e.hunting !== false)) sec.effect++;
        break;
      case 'pickup':
        sec.pending = { kind: 'pickup', offered: [...(e.items ?? [])], gold: e.gold ?? 0 };
        break;
      case 'combat':
        sec.pending = { kind: 'combat', enemyEndurance: def.combats[e.combat]!.endurance, rounds: 0 };
        sec.hadCombat = true;
        break;
      case 'random':
        sec.pending = { kind: 'random' };
        break;
      case 'die':
        die(s, ev, 'effect');
        break;
      case 'restoreEndurance':
        changeEndurance(book, s, ev, maxEndurance(book, s.character) - s.character.endurance, 'effect');
        sec.effect++;
        break;
      case 'combatSkill':
        s.character.combatSkill += e.delta;
        ev.push({ type: 'combatSkill', delta: e.delta, combatSkill: s.character.combatSkill });
        sec.effect++;
        break;
      case 'loseAll':
        for (const slot of e.slots) for (const item of [...slotItems(s.character, slot)]) lose(book, s, ev, item);
        sec.effect++;
        break;
      case 'loseBackpack':
        if (s.character.hasBackpack) {
          for (const item of [...s.character.backpack]) lose(book, s, ev, item);
          s.character.hasBackpack = false;
          ev.push({ type: 'backpackLost' });
        }
        sec.effect++;
        break;
      case 'stealOne':
        steal(book, s, ev, e.from, e.fallback);
        sec.effect++;
        break;
      case 'hook':
        throw new Error(`hook ${e.name} is not implemented`);
    }
  }
}

// One round. Afterwards, in order: hero death, damage branch, victory, timeout.
// Returns true while the fight goes on (for an evasion: the escape may proceed).
function fightRound(book: EngineBook, s: GameState, ev: GameEvent[], evading: boolean): boolean {
  const sec = s.section!;
  const pending = sec.pending as { enemyEndurance: number; rounds: number };
  const e = currentEffect(book, s) as CombatEffect;
  const enemy = sectionDef(book, sec.number).combats[e.combat]!;
  const combatSkill = heroCombatSkill(book, s, e);
  const ratio = combatSkill - enemy.combatSkill;
  const [enemyLoss, heroLoss] = combatResult(ratio, draw(s, ev, 'combat'));
  pending.rounds++;
  sec.rounds = pending.rounds;
  if (!evading) pending.enemyEndurance = enemyLoss === 'k' ? 0 : Math.max(0, pending.enemyEndurance - enemyLoss);
  ev.push({
    type: 'combatRound',
    combat: e.combat,
    round: pending.rounds,
    combatSkill,
    ratio,
    enemyLoss: evading ? 0 : enemyLoss,
    heroLoss,
    enemyEndurance: pending.enemyEndurance,
    evading,
  });
  const before = s.character.endurance;
  changeEndurance(book, s, ev, heroLoss === 'k' ? -s.character.endurance : -heroLoss, 'combat');
  if (s.phase !== 'section') return false;
  if (e.onHeroLoss && s.character.endurance < before) {
    leaveCombat(book, s, ev, e, 'heroLoss', e.onHeroLoss.choice);
    return false;
  }
  if (evading) return true;
  if (pending.enemyEndurance === 0) {
    ev.push({ type: 'enemyDefeated', combat: e.combat, rounds: pending.rounds });
    finishEffect(s);
    return false;
  }
  if (e.maxRounds !== undefined && pending.rounds >= e.maxRounds) {
    leaveCombat(book, s, ev, e, 'timeout', e.timeout!.choice);
    return false;
  }
  return true;
}

function leaveCombat(
  book: EngineBook,
  s: GameState,
  ev: GameEvent[],
  e: CombatEffect,
  reason: 'heroLoss' | 'timeout',
  ordinal: number,
): void {
  leaveVia(book, s, ev, ordinal, (to) => ev.push({ type: 'combatEnded', combat: e.combat, reason, to }));
}

// An automatic exit through a choice: its effects apply once, and no Healing is granted.
function leaveVia(book: EngineBook, s: GameState, ev: GameEvent[], ordinal: number, announce: (to: number) => void): void {
  const rule = sectionDef(book, s.section!.number).rules.choices?.[String(ordinal)];
  for (const effect of rule?.effects ?? []) applyAuto(book, s, ev, effect);
  if (s.phase !== 'section') return;
  const target = choiceTarget(book, s, ordinal);
  announce(target);
  enterSection(s, ev, target);
}

function applyAuto(book: EngineBook, s: GameState, ev: GameEvent[], e: AutoEffect): void {
  if (e.when && !holds(book, s, e.when)) return;
  if (e.op === 'endurance') changeEndurance(book, s, ev, e.delta, 'effect', e.fatigue === true);
  else if (e.op === 'gold') changeGold(s.character, ev, e.delta);
  else for (const item of e.items) if (carried(s.character).includes(item)) lose(book, s, ev, item);
}

// Returns true once the meal is settled; false when the player must pick which meal to eat.
function startMeal(book: EngineBook, s: GameState, ev: GameEvent[], huntingFeeds: boolean): boolean {
  const c = s.character;
  if (huntingFeeds && c.disciplines.includes('hunting')) {
    ev.push({ type: 'meal', outcome: 'hunted' });
    return true;
  }
  const kinds = unique(c.backpack).filter((id) => {
    const def = book.items[id];
    return def?.slot === 'backpack' && def.meal;
  });
  if (kinds.length > 1) {
    s.section!.pending = { kind: 'meal', options: kinds };
    return false;
  }
  if (kinds.length === 1) {
    consumeMeal(book, s, ev, kinds[0]!);
  } else {
    ev.push({ type: 'meal', outcome: 'starved' });
    changeEndurance(book, s, ev, -HUNGER_LOSS, 'hunger');
  }
  return true;
}

// A meal item with a use (Laumspur) also restores its ENDURANCE when eaten as a Meal.
function consumeMeal(book: EngineBook, s: GameState, ev: GameEvent[], item: ItemId): void {
  s.character.backpack.splice(s.character.backpack.indexOf(item), 1);
  ev.push({ type: 'meal', outcome: 'ate', item }, { type: 'itemLost', item });
  const def = book.items[item];
  if (def?.slot === 'backpack' && def.use) changeEndurance(book, s, ev, def.use.endurance, 'item');
}

function steal(book: EngineBook, s: GameState, ev: GameEvent[], from: Slot, fallback: Slot | undefined): void {
  let pool = slotItems(s.character, from);
  if (!pool.length && fallback) pool = slotItems(s.character, fallback);
  if (!pool.length) return;
  const item = pool[drawBelow(s.rng, pool.length)]!;
  ev.push({ type: 'stolen', item });
  lose(book, s, ev, item);
}

type Slot = 'weapon' | 'backpack' | 'special';
function slotItems(c: Character, slot: Slot): ItemId[] {
  if (slot === 'weapon') return c.weapons;
  if (slot === 'backpack') return c.hasBackpack ? c.backpack : [];
  return c.specialItems;
}

function changeEndurance(
  book: EngineBook,
  s: GameState,
  ev: GameEvent[],
  delta: number,
  cause: 'effect' | 'healing' | 'hunger' | 'item' | 'combat',
  fatigue = false,
): void {
  const c = s.character;
  const max = maxEndurance(book, c);
  const before = c.endurance;
  // Healing restores wounds only: it stops short of losses from hunger or fatigue.
  const ceiling = cause === 'healing' ? max - s.fatigue : max;
  c.endurance = Math.max(0, Math.min(ceiling, c.endurance + delta));
  const change = c.endurance - before;
  if (change < 0 && (cause === 'hunger' || fatigue)) s.fatigue -= change;
  if (change > 0 && cause !== 'healing') s.fatigue = Math.max(0, s.fatigue - change);
  s.fatigue = Math.min(s.fatigue, max - c.endurance);
  if (change !== 0) ev.push({ type: 'endurance', delta: change, endurance: c.endurance, cause });
  if (c.endurance === 0) die(s, ev, 'endurance');
}

function changeGold(c: Character, ev: GameEvent[], delta: number): void {
  const before = c.gold;
  c.gold = Math.max(0, Math.min(MAX_GOLD, c.gold + delta));
  if (c.gold !== before) ev.push({ type: 'gold', delta: c.gold - before, gold: c.gold });
}

function gain(book: EngineBook, c: Character, ev: GameEvent[], item: ItemId): void {
  const def = book.items[item]!;
  if (def.slot === 'weapon') c.weapons.push(item);
  else if (def.slot === 'backpack') c.backpack.push(item);
  else {
    if (!c.specialItems.includes(item)) c.endurance += def.endurance ?? 0;
    c.specialItems.push(item);
  }
  ev.push({ type: 'itemGained', item });
}

function lose(book: EngineBook, s: GameState, ev: GameEvent[], item: ItemId): void {
  const c = s.character;
  for (const list of [c.weapons, c.backpack, c.specialItems]) {
    const i = list.indexOf(item);
    if (i >= 0) {
      list.splice(i, 1);
      break;
    }
  }
  c.endurance = Math.min(c.endurance, maxEndurance(book, c));
  s.fatigue = Math.min(s.fatigue, maxEndurance(book, c) - c.endurance);
  ev.push({ type: 'itemLost', item });
}

function hasRoom(book: EngineBook, c: Character, item: ItemId): boolean {
  const def = book.items[item]!;
  if (def.slot === 'weapon') return c.weapons.length < MAX_WEAPONS;
  if (def.slot === 'backpack') return c.hasBackpack && c.backpack.length < MAX_BACKPACK;
  return true;
}

// Usable items heal at any time, even between combat rounds; one marked notBeforeCombat
// (the Healing Potion) waits until no fight is under way or still to come in the section.
function canUse(book: EngineBook, s: GameState, item: ItemId): boolean {
  const def = book.items[item];
  if (def?.slot !== 'backpack' || !def.use) return false;
  if (s.character.endurance >= maxEndurance(book, s.character)) return false;
  if (!def.use.notBeforeCombat) return true;
  const sec = s.section!;
  const effects = sectionDef(book, sec.number).rules.effects ?? [];
  return !effects.slice(sec.effect).some((e) => e.op === 'combat');
}

function enterSection(s: GameState, ev: GameEvent[], number: number): void {
  const from = s.section?.number ?? null;
  s.section = { number, from, effect: 0, pending: null, hadCombat: false, draws: [], rounds: null };
  if (!s.visited.includes(number)) {
    s.visited.push(number);
    s.visited.sort((a, b) => a - b);
  }
  ev.push({ type: 'section', number });
}

function finishEffect(s: GameState): void {
  s.section!.pending = null;
  s.section!.effect++;
}

function die(s: GameState, ev: GameEvent[], cause: 'endurance' | 'deadEnd' | 'effect'): void {
  s.phase = 'dead';
  ev.push({ type: 'died', cause });
}

function draw(s: GameState, ev: GameEvent[], purpose: RollPurpose): number {
  const value = draw10(s.rng);
  ev.push({ type: 'rolled', purpose, value });
  return value;
}

function sectionDef(book: EngineBook, number: number): EngineSection {
  const def = book.sections[number];
  if (!def) throw new Error(`section ${number} is not in book ${book.id}`);
  return def;
}

function currentEffect(book: EngineBook, s: GameState) {
  return (sectionDef(book, s.section!.number).rules.effects ?? [])[s.section!.effect];
}

function choiceTarget(book: EngineBook, s: GameState, ordinal: number): number {
  const choice = sectionDef(book, s.section!.number).choices.find((ch) => ch.ordinal === ordinal);
  if (!choice) throw new Error(`section ${s.section!.number} has no choice ${ordinal}`);
  return choice.target;
}

function weaponKind(book: EngineBook, item: ItemId): WeaponKind | undefined {
  const def = book.items[item];
  return def?.slot === 'weapon' ? def.weapon : undefined;
}

function carried(c: Character): ItemId[] {
  return [...c.weapons, ...c.backpack, ...c.specialItems];
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function inRange(x: number, r: Pick<Range, 'min' | 'max'>): boolean {
  return (r.min === undefined || x >= r.min) && (r.max === undefined || x <= r.max);
}

function sameAction(a: Action, b: Action): boolean {
  const key = (x: Action) => JSON.stringify(Object.entries(x).sort(([p], [q]) => p.localeCompare(q)));
  return key(a) === key(b);
}

export function exportCharacter(book: EngineBook, s: GameState): CharacterRecord {
  if (s.phase !== 'won') throw new Error('only a character who completed the book can be exported');
  // Completion counts only under complete rules: not in reader or partial development books.
  if (book.unreviewed.length) throw new Error('this book has sections without rules, so completion cannot be exported');
  const { combatSkill, baseEndurance, disciplines, weaponskill, weapons, backpack, specialItems, gold, hasBackpack } =
    s.character;
  return {
    version: 2,
    completedBook: book.id,
    combatSkill,
    baseEndurance,
    disciplines: [...disciplines],
    weaponskill,
    weapons: [...weapons],
    backpack: [...backpack],
    specialItems: [...specialItems],
    gold,
    hasBackpack,
  };
}
