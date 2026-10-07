import type { Book, ContentPart, Footnote, Section, TextBlock } from './book';
import { attr, children, document, element, hasClass, plain, walk, type Element, type Node } from './dom';
import { checkGraph } from './graph';
import { decode, sha256, type Source } from './source';

const sectionId = /^sect([1-9]\d*)$/;
const footnoteId = /^sect([1-9]\d*)-([1-9]\d*)-foot$/;
function refs(node: Node): string[] {
  return [...new Set([...walk(node)].flatMap((n) => {
    const href = attr(n, 'href') ?? '';
    return /^#sect\d+-\d+-foot$/.test(href) ? [href.slice(1)] : [];
  }))];
}
const block = (node: Node, kind: TextBlock['kind'] = 'paragraph'): TextBlock => ({ kind, text: plain(node), footnoteRefs: refs(node) });
const headingId = (node: Element): string | undefined => [...walk(node)].map((n) => attr(n, 'id')).find(Boolean);

export function parseBook(source: Source): Book {
  const root = document(decode(source.bytes));
  const containers = [...walk(root)].filter((n) => hasClass(n, 'numbered'));
  if (containers.length !== 1) throw new Error('expected one div.numbered container');
  const numbered = containers[0]!;
  if (numbered.tagName !== 'div') throw new Error('unsupported numbered container');
  const title = [...walk(root)].find((n) => n.tagName === 'h1');
  if (!title || !plain(title)) throw new Error('missing book title');
  const book: Book = {
    formatVersion: 1, id: '01fftd', title: plain(title), sourceSha256: sha256(source.bytes),
    source: { format: 'project-aon-xhtml-simple', entryPath: source.entryPath,
      archiveSha256: source.archiveSha256, editionLabel: null, originalFile: 'source.htm' },
    frontMatter: [], sections: [], footnotes: [], illustrations: [],
  };

  let section: Section | undefined;
  for (const node of children(numbered)) {
    if (!element(node)) {
      if (plain(node)) throw new Error('unexpected unwrapped numbered text');
      continue;
    }
    if (node.tagName === 'h2' && !section && headingId(node) === 'numbered') continue;
    if (node.tagName === 'h3') {
      const id = headingId(node) ?? '';
      const match = sectionId.exec(id);
      if (!match) throw new Error(`unsupported section heading: ${id}`);
      section = { number: Number(match[1]), choices: [], combats: [], deadEnd: false, blocks: [] };
      book.sections.push(section);
      continue;
    }
    if (!section) throw new Error('content before first numbered section');
    if (node.tagName === 'p' && hasClass(node, 'choice')) {
      const targets = [...walk(node)].flatMap((n) => {
        const match = /^#sect([1-9]\d*)$/.exec(attr(n, 'href') ?? '');
        return match ? [Number(match[1])] : [];
      });
      if (targets.length !== 1) throw new Error(`section ${section.number}: expected one choice target`);
      const ordinal = section.choices.length + 1;
      section.choices.push({ ordinal, target: targets[0]!, text: plain(node) });
      section.blocks.push({ kind: 'choice', ordinal });
    } else if (node.tagName === 'p' && hasClass(node, 'combat')) {
      const combat = /^(.*?):\s*COMBAT\s*SKILL\s*(\d+)\s+ENDURANCE\s*(\d+)\s*$/.exec(plain(node));
      if (!combat || !combat[1]?.trim()) throw new Error(`section ${section.number}: unrecognized combat block`);
      const index = section.combats.length;
      section.combats.push({ name: combat[1].trim(), text: plain(node), combatSkill: Number(combat[2]), endurance: Number(combat[3]) });
      section.blocks.push({ kind: 'combat', index });
    } else if (node.tagName === 'div' && hasClass(node, 'illustration')) {
      const ordinal = book.illustrations.filter((i) => i.section === section!.number).length + 1;
      const id = `s${section.number}_illustration${ordinal}`;
      book.illustrations.push({ id, section: section.number, label: plain(node), file: null });
      section.blocks.push({ kind: 'illustration', id });
    } else if (node.tagName === 'span' && hasClass(node, 'signpost')) {
      section.blocks.push(block(node, 'signpost'));
    } else if (node.tagName === 'blockquote') {
      section.blocks.push(block(node, 'quote'));
    } else if (node.tagName === 'p' && (!attr(node, 'class') || hasClass(node, 'deadend'))) {
      if (hasClass(node, 'deadend')) section.deadEnd = true;
      section.blocks.push(block(node));
    } else {
      throw new Error(`section ${section.number}: unsupported block ${node.tagName}.${attr(node, 'class') ?? ''}`);
    }
  }

  // Only pre-numbered front matter is transformed. Appendices, including the
  // complete licence and tables, remain verbatim in the retained source.htm.
  let part: ContentPart | undefined;
  for (const node of walk(root)) {
    if (node === numbered) break;
    if (/^h[1-6]$/.test(node.tagName)) {
      const id = headingId(node);
      if (id) { part = { id, title: plain(node), blocks: [] }; book.frontMatter.push(part); }
    } else if (part && ['p', 'li'].includes(node.tagName)) {
      part.blocks.push(block(node));
    }
  }
  for (const node of walk(root)) {
    const match = footnoteId.exec(attr(node, 'id') ?? '');
    if (!match) continue;
    let parent: Node | null = node.parentNode;
    while (parent && (!element(parent) || parent.tagName !== 'p')) parent = 'parentNode' in parent ? parent.parentNode : null;
    if (!parent) throw new Error(`footnote ${attr(node, 'id')}: missing paragraph`);
    const footnote: Footnote = { id: attr(node, 'id')!, section: Number(match[1]), marker: plain(node), blocks: [block(parent)] };
    if (book.footnotes.some((f) => f.id === footnote.id)) throw new Error(`duplicate footnote ${footnote.id}`);
    book.footnotes.push(footnote);
  }
  const notes = new Map(book.footnotes.map((f) => [f.id, f]));
  const sections = new Set(book.sections.map((s) => s.number));
  for (const note of book.footnotes) if (!sections.has(note.section)) throw new Error(`footnote for missing section ${note.section}`);
  for (const section of book.sections) {
    for (const ref of refsForSection(section)) {
      if (!notes.has(ref) || notes.get(ref)!.section !== section.number) throw new Error(`section ${section.number}: unresolved footnote ${ref}`);
    }
  }
  if (book.sections.length !== 350 || Array.from({ length: 350 }, (_, i) => i + 1).some((n) => !sections.has(n))) {
    throw new Error('Book 1 must contain every section 1–350 exactly once');
  }
  const graph = checkGraph(book);
  if (!graph.ok) throw new Error(graph.problems.join('\n'));
  return book;
}
function refsForSection(section: Section): string[] {
  return section.blocks.flatMap((b) => 'footnoteRefs' in b ? b.footnoteRefs : []);
}
