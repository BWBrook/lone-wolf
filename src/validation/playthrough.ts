import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  apply, availableActions, exportCharacter, maxEndurance, newGame, newSave, replay,
  type Action, type EngineBook, type GameEvent, type GameState, type SaveGame,
} from '../engine';
import type { Discipline } from '../engine/rules';

// The policy has its own PRNG. It never changes the engine RNG, initial character,
// or section state: every run starts with newGame and uses offered actions only.
export function chooser(seed: number): <T>(values: readonly T[]) => T {
  let x = seed | 0;
  return <T>(values: readonly T[]) => {
    assert.ok(values.length, 'cannot choose from an empty list');
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
    return values[(x >>> 0) % values.length]!;
  };
}

export function assertInvariants(book: EngineBook, s: GameState): void {
  const c = s.character, max = maxEndurance(book, c);
  for (const value of [c.combatSkill, c.baseEndurance, c.endurance, c.gold, s.fatigue]) {
    assert.ok(Number.isSafeInteger(value), 'character numbers must be finite integers');
  }
  assert.ok(c.endurance >= 0 && c.endurance <= max, 'ENDURANCE outside its limits');
  assert.ok(s.fatigue >= 0 && s.fatigue <= max - c.endurance, 'fatigue outside its limits');
  assert.ok(c.gold >= 0 && c.gold <= 50, 'Gold outside its limits');
  assert.ok(c.weapons.length <= 2 && c.backpack.length <= 8, 'carrying limit exceeded');
  assert.ok(c.hasBackpack || c.backpack.length === 0, 'lost Backpack still has contents');
  for (const [slot, items] of [['weapon', c.weapons], ['backpack', c.backpack], ['special', c.specialItems]] as const) {
    for (const item of items) assert.equal(book.items[item]?.slot, slot, 'item in the wrong slot: ' + item);
  }
  assert.equal(new Set(c.disciplines).size, c.disciplines.length, 'duplicate discipline');
  assert.ok(c.disciplines.length <= book.setup.disciplines, 'too many disciplines');
  if (s.phase === 'section' || s.phase === 'won') assert.ok(c.endurance > 0, 'living character has no ENDURANCE');
  if (s.phase === 'won') assert.equal(s.section?.number, book.finalSection, 'win outside final section');
}

// Structural shortest distances are only a routing hint. Conditions and RNG still
// decide which actions actually exist; an attempt may die without reaching target.
export function distancesTo(book: EngineBook, target: number): Map<number, number> {
  assert.ok(book.sections[target], 'target section does not exist: ' + target);
  const incoming = new Map<number, number[]>();
  for (const section of Object.values(book.sections)) {
    for (const choice of section.choices) {
      const list = incoming.get(choice.target) ?? [];
      list.push(section.number);
      incoming.set(choice.target, list);
    }
  }
  const distances = new Map([[target, 0]]), queue = [target];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i]!;
    for (const from of incoming.get(n) ?? []) {
      if (!distances.has(from)) {
        distances.set(from, distances.get(n)! + 1);
        queue.push(from);
      }
    }
  }
  return distances;
}

export function progressAction(
  book: EngineBook, s: GameState, actions: Action[], pick: ReturnType<typeof chooser>,
  distances?: ReadonlyMap<number, number>,
): Action {
  // Pickups and trades finish after a bounded number of actions. Avoid incidental
  // drops: they would spend steps without testing a new section or required effect.
  const replacement = actions.find((a) => a.type === 'takeBackpack');
  if (replacement) return replacement;
  const gold = actions.find((a) => a.type === 'takeGold');
  if (gold) return gold;
  const take = actions.filter((a) => a.type === 'take');
  if (take.length) return pick(take);
  const trade = actions.filter((a) => a.type === 'tradeWeapon');
  if (trade.length) return pick(trade);
  const usable = actions.filter((a) => a.type === 'use');
  if (usable.length) return pick(usable);
  const progress = actions.filter((a) => a.type !== 'drop');
  const choices = progress.filter((a): a is Extract<Action, {type: 'choose'}> => a.type === 'choose');
  if (distances && choices.length) {
    const section = book.sections[s.section!.number]!;
    const distance = (a: Extract<Action, {type: 'choose'}>) => distances.get(section.choices.find((c) => c.ordinal === a.ordinal)!.target) ?? Infinity;
    const best = Math.min(...choices.map(distance));
    if (Number.isFinite(best)) return pick(choices.filter((a) => distance(a) === best));
  }
  // Combat automatic exits can be the route to a target, too.
  if (distances && s.section?.pending?.kind === 'combat') {
    const section = book.sections[s.section.number]!;
    const effect = section.rules.effects![s.section.effect]!;
    if (effect.op === 'combat' && effect.evade && actions.some((a) => a.type === 'evade')) {
      const to = section.choices.find((c) => c.ordinal === effect.evade!.choice)!.target;
      // Fighting may end by victory, a timeout, or a damage branch. In particular,
      // an immediate escape must not hide the timeout route to a directed target.
      const fightChoices = section.choices.filter((c) => c.ordinal !== effect.evade!.choice);
      if ((distances.get(to) ?? Infinity) < Math.min(...fightChoices.map((c) => distances.get(c.target) ?? Infinity))) return {type:'evade'};
      return {type:'fight'};
    }
  }
  return pick(progress.length ? progress : actions);
}

export interface TraceStep {
  action: Action;
  phase: GameState['phase'];
  section: number | null;
  endurance: number;
  fatigue: number;
  gold: number;
  events: GameEvent[];
  stateSha256: string;
}

// This hashes engine state only: no imported text or source markup reaches it.
export const stateHash = (s: GameState): string => createHash('sha256').update(JSON.stringify(s)).digest('hex');

export function traceSave(book: EngineBook, data: unknown): { state: GameState; steps: TraceStep[] } {
  const expected = replay(book, data); // validate metadata/actions before recording
  const save = data as SaveGame;
  let state = newGame(save.seed);
  const steps: TraceStep[] = [];
  for (const action of save.actions) {
    const result = apply(book, state, action);
    state = result.state;
    assertInvariants(book, state);
    steps.push({action, phase:state.phase, section:state.section?.number ?? null, endurance:state.character.endurance,
      fatigue:state.fatigue, gold:state.character.gold, events:result.events, stateSha256:stateHash(state)});
  }
  assert.deepEqual(state, expected);
  return {state, steps};
}

export interface GameRun {
  seed: number;
  policySeed: number;
  target: number | null;
  disciplinePlan: Discipline[] | null;
  hitTarget: boolean;
  save: SaveGame;
  state: GameState;
  sections: number[];
  choices: string[];
  actions: Record<string, number>;
  combatExits: Record<string, number>;
}

export function runGame(book: EngineBook, seed: number, options: {target?: number; policySeed?: number; maxSteps?: number; disciplines?: readonly Discipline[]} = {}): GameRun {
  assert.equal(book.unreviewed.length, 0, 'playthrough validation requires complete rules');
  const policySeed = options.policySeed ?? (seed ^ 0x6d2b79f5) >>> 0;
  const pick = chooser(policySeed), distances = options.target === undefined ? undefined : distancesTo(book, options.target);
  const save = newSave(book, seed);
  const sections: number[] = [], choices: string[] = [], actions: Record<string,number> = {}, combatExits: Record<string,number> = {};
  let state = newGame(seed), hitTarget = false;
  assertInvariants(book, state);
  for (let step = 0; step < (options.maxSteps ?? 1000) && state.phase !== 'won' && state.phase !== 'dead'; step++) {
    const offered = availableActions(book, state);
    assert.ok(offered.length, 'deadlock at seed ' + seed + ', section ' + state.section?.number);
    const preferred = state.phase === 'disciplines' ? options.disciplines?.find((d) => !state.character.disciplines.includes(d)) : undefined;
    const action: Action = preferred ? {type:'learn',discipline:preferred} : progressAction(book, state, offered, pick, hitTarget ? undefined : distances);
    const from = state.section?.number;
    if (action.type === 'choose') choices.push(from + ':' + action.ordinal);
    const result = apply(book, state, action);
    save.actions.push(action);
    actions[action.type] = (actions[action.type] ?? 0) + 1;
    state = result.state;
    assertInvariants(book, state);
    for (const event of result.events) {
      if (event.type === 'section') {
        assert.ok(from === undefined ? event.number === 1 : book.sections[from]!.choices.some((c) => c.target === event.number), 'noncanonical section transition');
        sections.push(event.number);
        if (event.number === options.target) hitTarget = true;
      }
      if (event.type === 'combatEnded' || event.type === 'evaded') {
        const reason = event.type === 'evaded' ? 'evaded' : event.reason;
        combatExits[reason] = (combatExits[reason] ?? 0) + 1;
      }
    }
  }
  assert.ok(state.phase === 'won' || state.phase === 'dead', 'step limit at seed ' + seed + ', section ' + state.section?.number);
  assert.deepEqual(replay(book, JSON.parse(JSON.stringify(save))), state, 'serialized Save replay mismatch');
  if (state.phase === 'won') {
    const exported = exportCharacter(book, state);
    assert.equal(exported.version, 2);
    assert.deepEqual(exportCharacter(book, replay(book, JSON.parse(JSON.stringify(save)))), exported);
  }
  return {seed, policySeed, target:options.target ?? null, disciplinePlan:options.disciplines ? [...options.disciplines] : null,
    hitTarget, save, state, sections, choices, actions, combatExits};
}

export interface Campaign {
  random: {games:number; wins:number; deaths:number; winRate:number; sections:number[]};
  directed: {games:number; wins:number; deaths:number; witnesses:{section:number; routingTarget:number; seed:number; policySeed:number; disciplinePlan:Discipline[] | null; terminal:'won'|'dead'}[]};
  sections: number[];
  unvisited: number[];
  choices: string[];
  actions: Record<string, number>;
  combatExits: Record<string, number>;
  winning: GameRun;
}

export function runCampaign(book: EngineBook, options: {games:number; directedAttempts?:number; recoveryAttempts?:number; maxSteps?:number}): Campaign {
  assert.ok(Number.isSafeInteger(options.games) && options.games > 0, 'games must be a positive integer');
  const attempts = options.directedAttempts ?? 256;
  assert.ok(Number.isSafeInteger(attempts) && attempts >= 0, 'directedAttempts must be a nonnegative integer');
  const recovery = options.recoveryAttempts ?? 4096;
  assert.ok(Number.isSafeInteger(recovery) && recovery >= 0, 'recoveryAttempts must be a nonnegative integer');
  const visited = new Set<number>(), randomVisited = new Set<number>(), choices = new Set<string>();
  const actions: Record<string,number> = {}, combatExits: Record<string,number> = {};
  let winning: GameRun | undefined;
  const random = {games:0,wins:0,deaths:0,winRate:0,sections:[] as number[]};
  const directed: Campaign['directed'] = {games:0,wins:0,deaths:0,witnesses:[]};
  const accumulate = (run: GameRun, counts: typeof random | typeof directed) => {
    counts.games++;
    if (run.state.phase === 'won') {counts.wins++; winning ??= run;} else counts.deaths++;
    for (const n of run.sections) {
      if (counts === directed && !visited.has(n)) {
        directed.witnesses.push({section:n,routingTarget:run.target!,seed:run.seed,policySeed:run.policySeed,
          disciplinePlan:run.disciplinePlan,terminal:run.state.phase as 'won'|'dead'});
      }
      visited.add(n);
    }
    run.choices.forEach((n) => choices.add(n));
    for (const [name,n] of Object.entries(run.actions)) actions[name] = (actions[name] ?? 0) + n;
    for (const [name,n] of Object.entries(run.combatExits)) combatExits[name] = (combatExits[name] ?? 0) + n;
  };
  for (let seed = 0; seed < options.games; seed++) {
    const run = runGame(book, seed, {maxSteps:options.maxSteps ?? 1000});
    accumulate(run, random);
    run.sections.forEach((n) => randomVisited.add(n));
  }
  random.winRate = random.wins / random.games;
  random.sections = [...randomVisited].sort((a,b) => a-b);
  for (const target of Object.keys(book.sections).map(Number).sort((a,b) => a-b)) {
    if (visited.has(target)) continue;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const seed = (0x100000 + target * 4096 + attempt) >>> 0;
      const run = runGame(book, seed, {target,maxSteps:options.maxSteps ?? 1000});
      accumulate(run, directed);
      if (run.hitTarget) break;
    }
  }
  // A second legal setup favours recovery rather than offensive combat bonuses.
  // It helps exercise surviving timeout branches which random setups rarely reach.
  const recoveryPlan: Discipline[] = ['healing','mindshield','hunting','tracking','camouflage'].slice(0,book.setup.disciplines) as Discipline[];
  for (const target of Object.keys(book.sections).map(Number).sort((a,b) => a-b)) {
    if (visited.has(target)) continue;
    for (let attempt = 0; attempt < recovery; attempt++) {
      const seed = (0x100000 + target * 4096 + attempt) >>> 0;
      const run = runGame(book,seed,{target,disciplines:recoveryPlan,maxSteps:options.maxSteps ?? 1000});
      accumulate(run,directed);
      if (run.hitTarget) break;
    }
  }
  assert.ok(winning, 'no reproducible winning game found');
  return {random,directed,sections:[...visited].sort((a,b)=>a-b),
    unvisited:Object.keys(book.sections).map(Number).filter((n)=>!visited.has(n)).sort((a,b)=>a-b),
    choices:[...choices].sort(),actions,combatExits,winning};
}
