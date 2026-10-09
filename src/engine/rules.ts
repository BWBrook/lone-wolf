import { z } from 'zod';

// Schema for our hand-encoded rules data (data/mechanics/<book>.json). It holds
// section numbers, choice ordinals, item ids and numbers only; never book prose.

export const DISCIPLINES = [
  'camouflage',
  'hunting',
  'sixthSense',
  'tracking',
  'healing',
  'weaponskill',
  'mindshield',
  'mindblast',
  'animalKinship',
  'mindOverMatter',
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const WEAPON_KINDS = [
  'dagger',
  'spear',
  'mace',
  'shortSword',
  'warhammer',
  'sword',
  'axe',
  'quarterstaff',
  'broadsword',
] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

const int = z.number().int();
export const Slot = z.enum(['weapon', 'backpack', 'special']);
export type Slot = z.infer<typeof Slot>;
export const ItemIdSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
const ItemId = ItemIdSchema;
const Ordinal = z.string().regex(/^[1-9]\d*$/);

const ordered = (r: { min?: number | undefined; max?: number | undefined }) =>
  r.min === undefined || r.max === undefined || r.min <= r.max;
export const Range = z.strictObject({ min: int.optional(), max: int.optional() }).refine(ordered, 'range min exceeds max');
export type Range = z.infer<typeof Range>;
// draw: which of the section's random draws (1-based); the latest when omitted.
export const DrawRange = z
  .strictObject({ min: int.optional(), max: int.optional(), draw: int.positive().optional() })
  .refine(ordered, 'range min exceeds max');
export type DrawRange = z.infer<typeof DrawRange>;
// Carried copies in a slot (a lost Backpack holds none).
export const InventoryRange = z
  .strictObject({ slot: Slot, min: int.nonnegative().optional(), max: int.nonnegative().optional() })
  .refine(ordered, 'range min exceeds max');
export type InventoryRange = z.infer<typeof InventoryRange>;

export type Condition =
  | { discipline: Discipline }
  | { item: string }
  | { gold: Range }
  | { endurance: Range }
  | { random: DrawRange }
  | { rounds: Range }
  | { visited: number }
  | { arrivedFrom: number }
  | { inventory: InventoryRange }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ discipline: z.enum(DISCIPLINES) }),
    z.strictObject({ item: ItemId }),
    z.strictObject({ gold: Range }),
    z.strictObject({ endurance: Range }),
    z.strictObject({ random: DrawRange }),
    z.strictObject({ rounds: Range }),
    z.strictObject({ visited: int.positive() }),
    // The section played immediately before this one; null at the start of a book.
    z.strictObject({ arrivedFrom: int.positive() }),
    z.strictObject({ inventory: InventoryRange }),
    z.strictObject({ not: Condition }),
    z.strictObject({ all: z.array(Condition).min(1) }),
    z.strictObject({ any: z.array(Condition).min(1) }),
  ]),
);

const when = { when: Condition.optional() };

// fatigue: true marks a loss from exhaustion or exposure, which Healing cannot restore.
const EnduranceEffect = z.strictObject({
  op: z.literal('endurance'),
  delta: int,
  fatigue: z.literal(true).optional(),
  ...when,
});
const GoldEffect = z.strictObject({ op: z.literal('gold'), delta: int, ...when });
const LoseEffect = z.strictObject({ op: z.literal('lose'), items: z.array(ItemId).min(1), ...when });

// Effects applied without player input; also the only effects a choice may carry.
export const AutoEffect = z.discriminatedUnion('op', [EnduranceEffect, GoldEffect, LoseEffect]);
export type AutoEffect = z.infer<typeof AutoEffect>;

const ChoiceRef = z.strictObject({ choice: int.positive() });
// Branches out of a fight. onHeroLoss: leave after any round in which Lone Wolf loses
// ENDURANCE and survives. maxRounds/timeout: leave if both still stand after that round.
const CombatEffect = z
  .strictObject({
    op: z.literal('combat'),
    combat: int.nonnegative(),
    mindblastImmune: z.boolean().optional(),
    unarmed: z.boolean().optional(),
    modifiers: z.array(z.strictObject({ combatSkill: int, ...when })).optional(),
    evade: z.strictObject({ afterRounds: int.nonnegative(), choice: int.positive() }).optional(),
    onHeroLoss: ChoiceRef.optional(),
    maxRounds: int.positive().optional(),
    timeout: ChoiceRef.optional(),
    ...when,
  })
  .refine((e) => (e.maxRounds === undefined) === (e.timeout === undefined), 'maxRounds and timeout go together');
export type CombatEffect = z.infer<typeof CombatEffect>;

export const Effect = z.discriminatedUnion('op', [
  EnduranceEffect,
  GoldEffect,
  LoseEffect,
  // hunting: false marks wasteland or desert, where Hunting does not feed you.
  z.strictObject({ op: z.literal('meal'), hunting: z.boolean().optional(), ...when }),
  // backpack: also offers a replacement Backpack, takeable only by someone without one.
  z
    .strictObject({
      op: z.literal('pickup'),
      items: z.array(ItemId).optional(),
      gold: int.positive().optional(),
      backpack: z.literal(true).optional(),
      ...when,
    })
    .refine(
      (e) => (e.items?.length ?? 0) > 0 || e.gold !== undefined || e.backpack === true,
      'a pickup offers at least one item, some gold or a Backpack',
    ),
  CombatEffect,
  z.strictObject({
    op: z.literal('random'),
    modifiers: z.array(z.strictObject({ add: int, when: Condition })).optional(),
    ...when,
  }),
  z.strictObject({ op: z.literal('die'), ...when }),
  z.strictObject({ op: z.literal('restoreEndurance'), ...when }),
  // Changes base COMBAT SKILL permanently; it carries into later books.
  z.strictObject({ op: z.literal('combatSkill'), delta: int, ...when }),
  z.strictObject({ op: z.literal('loseAll'), slots: z.array(Slot).min(1), ...when }),
  // Loses the Backpack itself and everything in it.
  z.strictObject({ op: z.literal('loseBackpack'), ...when }),
  // One carried copy chosen by the player (automatic when only one kind is carried).
  z.strictObject({ op: z.literal('loseOne'), from: Slot, ...when }),
  // One carried copy, drawn at random, from `from`, else from `fallback`.
  z.strictObject({ op: z.literal('stealOne'), from: Slot, fallback: Slot.optional(), ...when }),
  z.strictObject({ op: z.literal('hook'), name: z.string() }),
]);
export type Effect = z.infer<typeof Effect>;

export const SectionRules = z.strictObject({
  effects: z.array(Effect).optional(),
  choices: z.record(Ordinal, z.strictObject({ ...when, effects: z.array(AutoEffect).optional() })).optional(),
  note: z.string().optional(),
});
export type SectionRules = z.infer<typeof SectionRules>;

export const ItemDef = z.discriminatedUnion('slot', [
  z.strictObject({ slot: z.literal('weapon'), weapon: z.enum(WEAPON_KINDS) }),
  z.strictObject({
    slot: z.literal('backpack'),
    meal: z.literal(true).optional(),
    // notBeforeCombat: not during a fight, nor while one is still to come in the section.
    use: z.strictObject({ endurance: int.positive(), notBeforeCombat: z.literal(true).optional() }).optional(),
  }),
  z.strictObject({ slot: z.literal('special'), endurance: int.positive().optional() }),
]);
export type ItemDef = z.infer<typeof ItemDef>;

const Digit = z.enum(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export const Setup = z.strictObject({
  disciplines: int.positive().max(DISCIPLINES.length),
  items: z.array(ItemId),
  goldBase: int.nonnegative(),
  randomItem: z.record(
    Digit,
    z.strictObject({ items: z.array(ItemId).optional(), gold: int.positive().optional() }),
  ),
});
export type Setup = z.infer<typeof Setup>;

// A section with an entry here has been reviewed; {} means "reviewed: no mechanics".
export const BookRules = z.strictObject({
  book: z.string(),
  finalSection: int.positive(),
  items: z.record(ItemId, ItemDef),
  setup: Setup,
  sections: z.record(Ordinal, SectionRules),
});
export type BookRules = z.infer<typeof BookRules>;
