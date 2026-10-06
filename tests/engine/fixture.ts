import { buildEngineBook, type Character, type ImportedBook } from '../../src/engine';

// Synthetic test book: invented sections, no Project Aon content.
export const imported: ImportedBook = {
  id: 'test',
  sourceSha256: 'synthetic',
  sections: [
    { number: 1, choices: [c(1, 2), c(2, 3), c(3, 4), c(4, 10)], combats: [], deadEnd: false },
    { number: 2, choices: [c(1, 5), c(2, 6)], combats: [{ combatSkill: 12, endurance: 8 }], deadEnd: false },
    { number: 3, choices: [c(1, 5)], combats: [], deadEnd: false },
    { number: 4, choices: [c(1, 5)], combats: [], deadEnd: false },
    { number: 5, choices: [c(1, 7), c(2, 8)], combats: [], deadEnd: false },
    { number: 6, choices: [c(1, 5)], combats: [], deadEnd: false },
    { number: 7, choices: [], combats: [], deadEnd: true },
    { number: 8, choices: [c(1, 9), c(2, 7)], combats: [], deadEnd: false },
    { number: 9, choices: [], combats: [], deadEnd: false },
    { number: 10, choices: [c(1, 5)], combats: [], deadEnd: false },
    { number: 11, choices: [c(1, 5)], combats: [{ combatSkill: 30, endurance: 50 }], deadEnd: false },
  ],
};

export const rules = {
  book: 'test',
  finalSection: 9,
  items: {
    axe: { slot: 'weapon', weapon: 'axe' },
    sword: { slot: 'weapon', weapon: 'sword' },
    dagger: { slot: 'weapon', weapon: 'dagger' },
    meal: { slot: 'backpack', meal: true },
    potion: { slot: 'backpack', use: { endurance: 4 } },
    rope: { slot: 'backpack' },
    helmet: { slot: 'special', endurance: 2 },
    map: { slot: 'special' },
    key: { slot: 'special' },
  },
  setup: {
    disciplines: 5,
    items: ['axe', 'meal', 'map'],
    goldBase: 0,
    randomItem: {
      '0': { items: ['dagger'] },
      '1': { items: ['sword'] },
      '2': { items: ['helmet'] },
      '3': { items: ['meal', 'meal'] },
      '4': { items: ['rope'] },
      '5': { items: ['dagger'] },
      '6': { items: ['potion'] },
      '7': { items: ['dagger'] },
      '8': { items: ['sword'] },
      '9': { gold: 12 },
    },
  },
  sections: {
    '1': { choices: { '2': { when: { discipline: 'tracking' } }, '3': { when: { item: 'key' } } } },
    '2': { effects: [{ op: 'combat', combat: 0, evade: { afterRounds: 1, choice: 2 } }] },
    '3': { effects: [{ op: 'meal' }] },
    '4': { effects: [{ op: 'pickup', items: ['sword', 'potion', 'key'] }] },
    '5': {
      effects: [{ op: 'random', modifiers: [{ add: 2, when: { discipline: 'sixthSense' } }] }],
      choices: { '1': { when: { random: { max: 4 } } }, '2': { when: { random: { min: 5 } } } },
    },
    '6': { effects: [{ op: 'endurance', delta: -2, when: { not: { discipline: 'mindshield' } } }] },
    '7': {},
    '8': { choices: { '1': { when: { gold: { min: 5 } }, effects: [{ op: 'gold', delta: -5 }] } } },
    '9': {},
    '10': { effects: [{ op: 'meal', hunting: false }] },
    '11': { effects: [{ op: 'pickup', items: ['potion'] }, { op: 'combat', combat: 0 }] },
  },
};

export const book = buildEngineBook(imported, rules);

export function character(overrides: Partial<Character> = {}): Character {
  return {
    combatSkill: 15,
    baseEndurance: 25,
    endurance: 25,
    disciplines: ['camouflage', 'hunting', 'sixthSense', 'tracking', 'healing'],
    weaponskill: null,
    weapons: ['axe'],
    backpack: ['meal'],
    specialItems: ['map'],
    gold: 10,
    ...overrides,
  };
}

function c(ordinal: number, target: number) {
  return { ordinal, target };
}
