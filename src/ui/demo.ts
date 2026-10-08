import { buildEngineBook } from '../engine';
import type { PlayableBook, SectionText } from './content';

// A tiny invented adventure for developing the player without Project Aon files.
// Every word here is original to this project.
const text: Record<number, SectionText> = {
  1: {
    paragraphs: ['Dusk finds you at a crossroads. A lantern hangs from the signpost, swinging in the wind.'],
    choices: { 1: 'Take the north road', 2: 'Follow the faint tracks east', 3: 'Search around the signpost' },
    enemies: [],
  },
  2: {
    paragraphs: ['A half-starved dog bares its teeth and blocks the road.'],
    choices: { 1: 'Continue north once the dog is beaten', 2: 'Dive into the ditch to escape' },
    enemies: ['Wild Dog'],
  },
  3: {
    paragraphs: ['The tracks end at an abandoned camp. A sword and a wrapped meal lie beside the cold fire.'],
    choices: { 1: 'Return to the road' },
    enemies: [],
  },
  4: {
    paragraphs: ['Wedged behind the post is a small purse, and the lantern unhooks easily.'],
    choices: { 1: 'Return to the road' },
    enemies: [],
  },
  5: {
    paragraphs: ['You crawl through brambles and mud until the snarling fades behind you.'],
    choices: { 1: 'Climb back to the road further on' },
    enemies: [],
  },
  6: {
    paragraphs: ['Night falls on the open road. You stop to eat before going on.'],
    choices: { 1: 'Walk on to the river' },
    enemies: [],
  },
  7: {
    paragraphs: ['At the river a ferryman leans on his pole and names his price: five crowns.'],
    choices: { 1: 'Pay the ferryman', 2: 'Try to ford the river yourself' },
    enemies: [],
  },
  8: {
    paragraphs: ['The current is stronger than it looked. Pick a number to see how you fare.'],
    choices: { 1: 'The river takes your footing', 2: 'You find the shallows' },
    enemies: [],
  },
  9: {
    paragraphs: ['You reach the far bank as the lights of the town come into view. Your journey is complete.'],
    choices: {},
    enemies: [],
  },
  10: {
    paragraphs: ['The river sweeps you away into the dark. Your journey ends here.'],
    choices: {},
    enemies: [],
  },
};

const sections = [
  { number: 1, choices: [c(1, 2), c(2, 3), c(3, 4)], combats: [], deadEnd: false },
  { number: 2, choices: [c(1, 6), c(2, 5)], combats: [{ combatSkill: 11, endurance: 10 }], deadEnd: false },
  { number: 3, choices: [c(1, 6)], combats: [], deadEnd: false },
  { number: 4, choices: [c(1, 6)], combats: [], deadEnd: false },
  { number: 5, choices: [c(1, 6)], combats: [], deadEnd: false },
  { number: 6, choices: [c(1, 7)], combats: [], deadEnd: false },
  { number: 7, choices: [c(1, 9), c(2, 8)], combats: [], deadEnd: false },
  { number: 8, choices: [c(1, 10), c(2, 9)], combats: [], deadEnd: false },
  { number: 9, choices: [], combats: [], deadEnd: false },
  { number: 10, choices: [], combats: [], deadEnd: true },
];

const rules = {
  book: 'demo',
  finalSection: 9,
  items: {
    axe: { slot: 'weapon', weapon: 'axe' },
    sword: { slot: 'weapon', weapon: 'sword' },
    dagger: { slot: 'weapon', weapon: 'dagger' },
    meal: { slot: 'backpack', meal: true },
    healingPotion: { slot: 'backpack', use: { endurance: 4, notBeforeCombat: true } },
    helmet: { slot: 'special', endurance: 2 },
    map: { slot: 'special' },
    lantern: { slot: 'special' },
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
      '4': { items: ['healingPotion'] },
      '5': { items: ['dagger'] },
      '6': { items: ['healingPotion'] },
      '7': { items: ['sword'] },
      '8': { items: ['helmet'] },
      '9': { gold: 12 },
    },
  },
  sections: {
    '1': { choices: { '2': { when: { discipline: 'tracking' } } } },
    '2': { effects: [{ op: 'combat', combat: 0, evade: { afterRounds: 1, choice: 2 } }] },
    '3': { effects: [{ op: 'pickup', items: ['sword', 'meal'] }] },
    '4': { effects: [{ op: 'gold', delta: 5 }, { op: 'pickup', items: ['lantern'] }] },
    '5': { effects: [{ op: 'endurance', delta: -2 }] },
    '6': { effects: [{ op: 'meal' }] },
    '7': { choices: { '1': { when: { gold: { min: 5 } }, effects: [{ op: 'gold', delta: -5 }] } } },
    '8': {
      effects: [{ op: 'random', modifiers: [{ add: 2, when: { discipline: 'sixthSense' } }] }],
      choices: { '1': { when: { random: { max: 3 } } }, '2': { when: { random: { min: 4 } } } },
    },
    '9': {},
    '10': {},
  },
};

export const demoBook: PlayableBook = {
  title: 'Demo: The Lantern Road',
  engine: buildEngineBook({ id: 'demo', sourceSha256: 'demo', sections }, rules),
  text,
};

function c(ordinal: number, target: number) {
  return { ordinal, target };
}
