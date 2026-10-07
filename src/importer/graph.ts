import { gunzipSync } from 'node:zlib';
import { buildEngineBook } from '../engine/book';
import type { ImportedBook } from '../engine/types';
import { attr, children, document, element, hasClass, plain, walk } from './dom';
import { decode, MAX_HTML_BYTES, sha256 } from './source';

export interface GraphReport {
  ok: boolean;
  problems: string[];
  counts: { sections: number; choices: number; uniqueEdges: number; combats: number; combatSections: number; deadEnds: number };
  reachable: number[];
  unreachable: number[];
  finalReachable: boolean;
}
const positive = (n: number): boolean => Number.isSafeInteger(n) && n > 0;
export function checkGraph(book: ImportedBook): GraphReport {
  const problems: string[] = [], sections = new Map<number, ImportedBook['sections'][number]>();
  const edges = new Set<string>();
  let choices = 0, combats = 0, combatSections = 0, deadEnds = 0;
  if (!book || !Array.isArray(book.sections)) throw new Error('expected an imported book with sections');
  for (const s of book.sections) {
    if (!s || !positive(s.number) || !Array.isArray(s.choices) || !Array.isArray(s.combats) || typeof s.deadEnd !== 'boolean') throw new Error('invalid section structure');
    if (sections.has(s.number)) problems.push(`duplicate section ${s.number}`);
    sections.set(s.number, s);
    choices += s.choices.length; combats += s.combats.length;
    if (s.combats.length) combatSections++;
    if (s.deadEnd) deadEnds++;
    if (s.deadEnd && s.choices.length) problems.push(`dead end ${s.number} has choices`);
    s.choices.forEach((c, i) => {
      if (!c || c.ordinal !== i + 1 || !positive(c.target)) problems.push(`section ${s.number}: invalid choice ${i + 1}`);
      else edges.add(`${s.number}->${c.target}`);
    });
    for (const c of s.combats) if (!c || !positive(c.combatSkill) || !positive(c.endurance)) problems.push(`section ${s.number}: invalid combat values`);
  }
  for (const s of sections.values()) for (const c of s.choices) {
    if (c && !sections.has(c.target)) problems.push(`section ${s.number}: missing target ${c.target}`);
  }
  if (book.sections.length !== 350 || Array.from({ length: 350 }, (_, i) => i + 1).some((n) => !sections.has(n))) {
    problems.push('Book 1 requires every section 1–350 exactly once');
  }
  if (!sections.has(1)) problems.push('missing start section 1');
  if (!sections.has(350)) problems.push('missing final section 350');
  const reached = new Set<number>(), queue = sections.has(1) ? [1] : [];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i]!;
    if (reached.has(n)) continue;
    reached.add(n);
    for (const c of sections.get(n)!.choices) if (c && sections.has(c.target) && !reached.has(c.target)) queue.push(c.target);
  }
  const reachable = [...reached].sort((a, b) => a - b);
  const unreachable = [...sections.keys()].filter((n) => !reached.has(n)).sort((a, b) => a - b);
  if (unreachable.length) problems.push(`unreachable sections: ${unreachable.join(', ')}`);
  const finalReachable = reached.has(350);
  if (!finalReachable) problems.push('final section 350 is not reachable');
  return { ok: problems.length === 0, problems, counts: { sections: book.sections.length, choices, uniqueEdges: edges.size, combats, combatSections, deadEnds }, reachable, unreachable, finalReachable };
}
export interface SvgReport { status: 'passed' | 'failed'; sourceSha256: string; edges: number; missing: string[]; extra: string[] }
export function compareSvg(book: ImportedBook, input: Uint8Array): SvgReport {
  const bytes = input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input, { maxOutputLength: MAX_HTML_BYTES }) : input;
  if (bytes.length > MAX_HTML_BYTES) throw new Error('SVG exceeds size limit');
  const root = document(decode(bytes)), svg = [...walk(root)].filter((n) => n.tagName === 'svg');
  if (svg.length !== 1) throw new Error('expected one SVG graph');
  const actual = new Map<string, number>(), expected = new Map<string, number>();
  const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  let titleEdges = 0, edges = 0;
  for (const g of walk(svg[0]!)) {
    if (g.tagName !== 'g' || !hasClass(g, 'edge')) continue;
    const titles = children(g).filter((n) => element(n) && n.tagName === 'title');
    if (titles.length !== 1) throw new Error('SVG edge must have one title');
    const title = plain(titles[0]!);
    if (title === 'title->001') { titleEdges++; continue; }
    const match = /^(\d+)->(\d+)$/.exec(title);
    if (!match) throw new Error(`unrecognized SVG edge: ${title}`);
    add(actual, `${Number(match[1])}->${Number(match[2])}`); edges++;
  }
  if (titleEdges > 1) throw new Error('duplicate SVG title edge');
  for (const s of book.sections) for (const c of s.choices) add(expected, `${s.number}->${c.target}`);
  const missing: string[] = [], extra: string[] = [];
  for (const key of [...new Set([...expected.keys(), ...actual.keys()])].sort()) {
    const difference = (expected.get(key) ?? 0) - (actual.get(key) ?? 0);
    for (let i = 0; i < Math.abs(difference); i++) (difference > 0 ? missing : extra).push(key);
  }
  return { status: missing.length || extra.length ? 'failed' : 'passed', sourceSha256: sha256(input), edges, missing, extra };
}
export function checkRules(book: ImportedBook, rules: unknown): void { buildEngineBook(book, rules); }
