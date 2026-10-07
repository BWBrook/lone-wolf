import { buildEngineBook } from '../engine';
import type { Book } from '../importer/book';
import type { PlayableBook, SectionText } from './content';

// Combine an imported book (local content) with rules data for the player.
export function playableBook(book: Book, rules: unknown, options: { allowUnreviewed?: boolean } = {}): PlayableBook {
  const notes = new Map<number, string[]>();
  for (const f of book.footnotes) notes.set(f.section, [...(notes.get(f.section) ?? []), ...f.blocks.map((b) => b.text)]);
  const text: Record<number, SectionText> = {};
  for (const s of book.sections) {
    text[s.number] = {
      paragraphs: s.blocks.flatMap((b) => ('text' in b ? [b.text] : [])),
      notes: notes.get(s.number) ?? [],
      choices: Object.fromEntries(s.choices.map((c) => [c.ordinal, c.text])),
      enemies: s.combats.map((c) => c.name),
    };
  }
  return { title: book.title, engine: buildEngineBook(book, rules, options), text };
}

// An explicit reader request wins over available rules; without rules there is no
// playable book.
export function selectBook(imported: Book, rules: unknown | null, reader: boolean): PlayableBook {
  if (reader) return readerBook(imported);
  if (rules !== null) return playableBook(imported, rules);
  throw new Error('The rules for this book are not encoded yet. Add &reader to the address to read the text without rules.');
}

// Development only: browse an imported book's text before its rules exist. No
// section rules apply, so combats, items and meals are skipped; the starting kit
// is a placeholder rather than the book's.
export function readerBook(book: Book): PlayableBook {
  const endings = book.sections.filter((s) => !s.choices.length && !s.deadEnd);
  if (endings.length !== 1) throw new Error('cannot identify the final section');
  const rules = {
    book: book.id,
    finalSection: endings[0]!.number,
    items: { axe: { slot: 'weapon', weapon: 'axe' }, meal: { slot: 'backpack', meal: true } },
    setup: {
      disciplines: 5,
      items: ['axe', 'meal'],
      goldBase: 0,
      randomItem: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), {}])),
    },
    sections: {},
  };
  return {
    ...playableBook(book, rules, { allowUnreviewed: true }),
    notice: 'Reader mode: the text only. No rules apply, so fights, items and meals are skipped.',
  };
}
