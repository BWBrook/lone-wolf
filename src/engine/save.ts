import { z } from 'zod';
import { apply, newGame } from './engine';
import { DISCIPLINES, ItemIdSchema as ItemId } from './rules';
import type { EngineBook, GameState, SaveGame } from './types';

// Bump when a change to the engine alters what a recorded action sequence produces.
export const ENGINE_VERSION = 6;

export class InvalidSave extends Error {}
export class IncompatibleSave extends Error {}

const ordinal = z.number().int().positive();
const Action = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rollStats') }),
  z.strictObject({ type: z.literal('learn'), discipline: z.enum(DISCIPLINES) }),
  z.strictObject({ type: z.literal('rollWeaponskill') }),
  z.strictObject({ type: z.literal('rollEquipment') }),
  z.strictObject({ type: z.literal('take'), item: ItemId }),
  z.strictObject({ type: z.literal('drop'), item: ItemId }),
  z.strictObject({ type: z.literal('use'), item: ItemId }),
  z.strictObject({ type: z.literal('takeGold') }),
  z.strictObject({ type: z.literal('takeBackpack') }),
  z.strictObject({ type: z.literal('loseItem'), item: ItemId }),
  z.strictObject({ type: z.literal('tradeWeapon'), item: ItemId }),
  z.strictObject({ type: z.literal('eat'), item: ItemId }),
  z.strictObject({ type: z.literal('continue') }),
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('fight') }),
  z.strictObject({ type: z.literal('evade') }),
  z.strictObject({ type: z.literal('choose'), ordinal }),
]);

const Save = z.strictObject({
  version: z.literal(1),
  engine: z.number().int().positive(),
  book: z.string(),
  sourceSha256: z.string(),
  rulesFingerprint: z.string(),
  seed: z.number().int().min(0).max(0xffffffff),
  actions: z.array(Action),
});

export function newSave(book: EngineBook, seed: number): SaveGame {
  return {
    version: 1,
    engine: ENGINE_VERSION,
    book: book.id,
    sourceSha256: book.sourceSha256,
    rulesFingerprint: book.rulesFingerprint,
    seed,
    actions: [],
  };
}

export function parseSave(data: unknown): SaveGame {
  const result = Save.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new InvalidSave(`Not a valid save: ${issue?.path.join('.') || 'file'}: ${issue?.message ?? 'unknown error'}`);
  }
  return result.data;
}

// Validate a save completely and rebuild its state. Throws without side effects;
// an incompatible save is refused, never reinterpreted under different rules.
export function replay(book: EngineBook, data: unknown): GameState {
  const save = parseSave(data);
  const mismatch =
    save.engine !== ENGINE_VERSION
      ? `engine version ${save.engine}, this player runs ${ENGINE_VERSION}`
      : save.book !== book.id
        ? `book ${save.book}, not ${book.id}`
        : save.sourceSha256 !== book.sourceSha256
          ? 'a different edition of the book'
          : save.rulesFingerprint !== book.rulesFingerprint
            ? 'different rules data'
            : null;
  if (mismatch) throw new IncompatibleSave(`This save was made with ${mismatch}`);
  let s = newGame(save.seed);
  for (const action of save.actions) s = apply(book, s, action).state;
  return s;
}
