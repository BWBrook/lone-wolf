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
export const ItemIdSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
const ItemId = ItemIdSchema;
const Ordinal = z.string().regex(/^[1-9]\d*$/);

export const Range = z
  .strictObject({ min: int.optional(), max: int.optional() })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, 'range min exceeds max');
export type Range = z.infer<typeof Range>;

export type Condition =
  | { discipline: Discipline }
  | { item: string }
  | { gold: Range }
  | { endurance: Range }
  | { random: Range }
  | { rounds: Range }
  | { visited: number }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ discipline: z.enum(DISCIPLINES) }),
    z.strictObject({ item: ItemId }),
    z.strictObject({ gold: Range }),
    z.strictObject({ endurance: Range }),
    z.strictObject({ random: Range }),
    z.strictObject({ rounds: Range }),
    z.strictObject({ visited: int.positive() }),
    z.strictObject({ not: Condition }),
    z.strictObject({ all: z.array(Condition).min(1) }),
    z.strictObject({ any: z.array(Condition).min(1) }),
  ]),
);

const when = { when: Condition.optional() };

const EnduranceEffect = z.strictObject({ op: z.literal('endurance'), delta: int, ...when });
const GoldEffect = z.strictObject({ op: z.literal('gold'), delta: int, ...when });
const LoseEffect = z.strictObject({ op: z.literal('lose'), items: z.array(ItemId).min(1), ...when });

// Effects applied without player input; also the only effects a choice may carry.
export const AutoEffect = z.discriminatedUnion('op', [EnduranceEffect, GoldEffect, LoseEffect]);
export type AutoEffect = z.infer<typeof AutoEffect>;

const CombatEffect = z.strictObject({
  op: z.literal('combat'),
  combat: int.nonnegative(),
  mindblastImmune: z.boolean().optional(),
  unarmed: z.boolean().optional(),
  modifiers: z.array(z.strictObject({ combatSkill: int, ...when })).optional(),
  evade: z.strictObject({ afterRounds: int.nonnegative(), choice: int.positive() }).optional(),
  ...when,
});
export type CombatEffect = z.infer<typeof CombatEffect>;

export const Effect = z.discriminatedUnion('op', [
  EnduranceEffect,
  GoldEffect,
  LoseEffect,
  // hunting: false marks wasteland or desert, where Hunting does not feed you.
  z.strictObject({ op: z.literal('meal'), hunting: z.boolean().optional(), ...when }),
  z.strictObject({ op: z.literal('pickup'), items: z.array(ItemId).min(1), ...when }),
  CombatEffect,
  z.strictObject({
    op: z.literal('random'),
    modifiers: z.array(z.strictObject({ add: int, when: Condition })).optional(),
  }),
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
    use: z.strictObject({ endurance: int.positive() }).optional(),
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
