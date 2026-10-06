import type { EngineBook } from '../engine';

// Display text the player needs alongside the engine book. For Project Aon books
// this comes from the local importer output; it is never committed.
export interface SectionText {
  paragraphs: string[];
  choices: Record<number, string>;
  enemies: string[];
}

export interface PlayableBook {
  title: string;
  engine: EngineBook;
  text: Record<number, SectionText>;
}

export function humanize(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}
