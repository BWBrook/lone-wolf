import type { RngState } from './rng';
import type { Discipline, ItemDef, SectionRules, Setup, WeaponKind } from './rules';

export type ItemId = string;

// What the engine needs from an imported book. The importer's Book type is a
// structural superset (it adds text, illustrations and provenance).
export interface ImportedChoice {
  ordinal: number; // 1-based position among the section's choices, in source order
  target: number;
}
export interface ImportedCombat {
  combatSkill: number;
  endurance: number;
}
export interface ImportedSection {
  number: number;
  choices: ImportedChoice[];
  combats: ImportedCombat[];
  deadEnd: boolean;
}
export interface ImportedBook {
  id: string;
  sourceSha256: string;
  sections: ImportedSection[];
}

export interface EngineSection extends ImportedSection {
  rules: SectionRules;
}
export interface EngineBook {
  id: string;
  sourceSha256: string;
  rulesFingerprint: string;
  finalSection: number;
  items: Record<ItemId, ItemDef>;
  setup: Setup;
  sections: Record<number, EngineSection>;
  unreviewed: number[];
}

export interface Character {
  combatSkill: number;
  baseEndurance: number;
  endurance: number;
  disciplines: Discipline[];
  weaponskill: WeaponKind | null;
  weapons: ItemId[];
  backpack: ItemId[];
  specialItems: ItemId[];
  gold: number;
}

export type Pending =
  | { kind: 'pickup'; offered: ItemId[] }
  | { kind: 'combat'; enemyEndurance: number; rounds: number }
  | { kind: 'random' }
  | { kind: 'choose' };

export interface SectionState {
  number: number;
  effect: number; // index of the effect being resolved
  pending: Pending | null;
  hadCombat: boolean;
  random: number | null;
  rounds: number | null; // rounds fought in this section's latest combat
}

export type Phase = 'stats' | 'disciplines' | 'weaponskill' | 'equipment' | 'section' | 'dead' | 'won';

export interface GameState {
  version: 1;
  rng: RngState;
  phase: Phase;
  character: Character;
  section: SectionState | null;
  visited: number[];
}

export type Action =
  | { type: 'rollStats' }
  | { type: 'learn'; discipline: Discipline }
  | { type: 'rollWeaponskill' }
  | { type: 'rollEquipment' }
  | { type: 'take'; item: ItemId }
  | { type: 'drop'; item: ItemId }
  | { type: 'use'; item: ItemId }
  | { type: 'continue' }
  | { type: 'roll' }
  | { type: 'fight' }
  | { type: 'evade' }
  | { type: 'choose'; ordinal: number };

export type RollPurpose = 'combatSkill' | 'endurance' | 'weaponskill' | 'gold' | 'equipment' | 'section' | 'combat';

export type GameEvent =
  | { type: 'rolled'; purpose: RollPurpose; value: number; total?: number }
  | { type: 'section'; number: number }
  | {
      type: 'combatRound';
      combat: number;
      round: number;
      combatSkill: number;
      ratio: number;
      enemyLoss: number | 'k';
      heroLoss: number | 'k';
      enemyEndurance: number;
      evading: boolean;
    }
  | { type: 'enemyDefeated'; combat: number; rounds: number }
  | { type: 'evaded'; to: number }
  | { type: 'endurance'; delta: number; endurance: number; cause: 'effect' | 'healing' | 'hunger' | 'item' | 'combat' }
  | { type: 'gold'; delta: number; gold: number }
  | { type: 'itemGained'; item: ItemId }
  | { type: 'itemLost'; item: ItemId }
  | { type: 'meal'; outcome: 'hunted' | 'ate' | 'starved' }
  | { type: 'died' }
  | { type: 'won' };

// A save replays from its seed, so it is valid only for the same book edition,
// the same rules data and the same engine semantics.
export interface SaveGame {
  version: 1;
  engine: number;
  book: string;
  sourceSha256: string;
  rulesFingerprint: string;
  seed: number;
  actions: Action[];
}

// Carried into the next book; separate from saves and versioned on its own.
export interface CharacterRecord {
  version: 1;
  completedBook: string;
  combatSkill: number;
  baseEndurance: number;
  disciplines: Discipline[];
  weaponskill: WeaponKind | null;
  weapons: ItemId[];
  backpack: ItemId[];
  specialItems: ItemId[];
  gold: number;
}
