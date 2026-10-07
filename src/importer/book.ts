import type { ImportedBook, ImportedChoice, ImportedCombat, ImportedSection } from '../engine/types';

// Shared with the browser adapter. This module imports types only, and no Node APIs.
export interface TextBlock {
  kind: 'paragraph' | 'quote' | 'signpost';
  text: string;
  footnoteRefs: string[];
}
export type SectionBlock = TextBlock
  | { kind: 'choice'; ordinal: number }
  | { kind: 'combat'; index: number }
  | { kind: 'illustration'; id: string };
export interface Choice extends ImportedChoice { text: string }
export interface Combat extends ImportedCombat { name: string; text: string }
export interface Section extends ImportedSection {
  blocks: SectionBlock[];
  choices: Choice[];
  combats: Combat[];
}
export interface ContentPart { id: string; title: string; blocks: TextBlock[] }
export interface Footnote { id: string; section: number; marker: string; blocks: TextBlock[] }
export interface Illustration { id: string; section: number; label: string; file: string | null }
export interface Book extends ImportedBook {
  formatVersion: 1;
  title: string;
  source: {
    format: 'project-aon-xhtml-simple';
    entryPath: string;
    archiveSha256: string | null;
    editionLabel: string | null;
    originalFile: 'source.htm';
  };
  frontMatter: ContentPart[];
  sections: Section[];
  footnotes: Footnote[];
  illustrations: Illustration[];
}
