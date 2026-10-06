import { BookRules, type Condition, type Effect } from './rules';
import type { EngineBook, EngineSection, ImportedBook } from './types';

const START_SECTION = 1;

// Combine an imported book with our rules data. Throws on any broken reference.
// Every section must have a rules entry ({} = reviewed, no mechanics); partial
// rules are accepted only when a caller deliberately passes allowUnreviewed.
export function buildEngineBook(
  imported: ImportedBook,
  rulesData: unknown,
  { allowUnreviewed = false }: { allowUnreviewed?: boolean } = {},
): EngineBook {
  const rules = BookRules.parse(rulesData);
  const problems: string[] = [];
  const has = (o: object, key: string | number) => Object.hasOwn(o, key);
  if (rules.book !== imported.id) problems.push(`rules are for ${rules.book}, book is ${imported.id}`);

  const sections: Record<number, EngineSection> = Object.create(null);
  for (const s of imported.sections) {
    if (has(sections, s.number)) problems.push(`section ${s.number} appears twice`);
    sections[s.number] = { ...s, rules: has(rules.sections, String(s.number)) ? rules.sections[String(s.number)]! : {} };
  }
  for (const s of imported.sections) {
    const ordinals = s.choices.map((ch) => ch.ordinal);
    if (new Set(ordinals).size !== ordinals.length) problems.push(`section ${s.number} has duplicate choice ordinals`);
    for (const ch of s.choices) {
      if (!Number.isInteger(ch.ordinal) || ch.ordinal < 1) problems.push(`section ${s.number} has choice ordinal ${ch.ordinal}`);
      if (!has(sections, ch.target)) problems.push(`section ${s.number} choice ${ch.ordinal} targets missing section ${ch.target}`);
    }
    if (s.deadEnd && s.choices.length) problems.push(`section ${s.number} is a dead end with choices`);
  }
  if (!has(sections, START_SECTION)) problems.push(`start section ${START_SECTION} does not exist`);
  if (!has(sections, rules.finalSection)) problems.push(`final section ${rules.finalSection} does not exist`);

  const item = (where: string, id: string) => {
    if (!has(rules.items, id)) problems.push(`${where}: unknown item ${id}`);
  };
  const condition = (where: string, c: Condition): void => {
    if ('item' in c) item(where, c.item);
    else if ('visited' in c && !has(sections, c.visited)) problems.push(`${where}: unknown section ${c.visited}`);
    else if ('not' in c) condition(where, c.not);
    else if ('all' in c) c.all.forEach((x) => condition(where, x));
    else if ('any' in c) c.any.forEach((x) => condition(where, x));
  };
  const effect = (where: string, e: Effect, section: EngineSection) => {
    if ('when' in e && e.when) condition(where, e.when);
    if (e.op === 'pickup' || e.op === 'lose') e.items.forEach((id) => item(where, id));
    if (e.op === 'combat') {
      if (!section.combats[e.combat]) problems.push(`${where}: no combat ${e.combat}`);
      if (e.evade && !section.choices.some((ch) => ch.ordinal === e.evade!.choice)) {
        problems.push(`${where}: evade choice ${e.evade.choice} does not exist`);
      }
      e.modifiers?.forEach((m) => m.when && condition(where, m.when));
    }
    if (e.op === 'random') e.modifiers?.forEach((m) => condition(where, m.when));
    if (e.op === 'hook') problems.push(`${where}: hook ${e.name} is not implemented`);
  };

  for (const [key, r] of Object.entries(rules.sections)) {
    const section = sections[Number(key)];
    if (!section) {
      problems.push(`rules for section ${key}, which does not exist`);
      continue;
    }
    r.effects?.forEach((e, i) => effect(`section ${key} effect ${i}`, e, section));
    for (const [ordinal, choice] of Object.entries(r.choices ?? {})) {
      const where = `section ${key} choice ${ordinal}`;
      if (!section.choices.some((ch) => ch.ordinal === Number(ordinal))) problems.push(`${where} does not exist`);
      if (choice.when) condition(where, choice.when);
      choice.effects?.forEach((e) => effect(where, e, section));
    }
  }
  rules.setup.items.forEach((id) => item('setup', id));
  Object.values(rules.setup.randomItem).forEach((r) => r.items?.forEach((id) => item('setup', id)));

  const unreviewed = imported.sections.map((s) => s.number).filter((n) => !has(rules.sections, String(n)));
  if (unreviewed.length && !allowUnreviewed) problems.push(`sections without rules: ${unreviewed.join(', ')}`);

  if (problems.length) throw new Error(`invalid rules for ${imported.id}:\n${problems.join('\n')}`);
  return {
    id: imported.id,
    sourceSha256: imported.sourceSha256,
    rulesFingerprint: fingerprint(rules),
    finalSection: rules.finalSection,
    items: Object.assign(Object.create(null), rules.items),
    setup: rules.setup,
    sections,
    unreviewed,
  };
}

// FNV-1a 64 over the UTF-16 code units of canonical JSON: identifies the rules data a save was made with.
function fingerprint(value: unknown): string {
  const canonical = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(canonical).join(',')}]`
      : v && typeof v === 'object'
        ? `{${Object.keys(v)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
            .join(',')}}`
        : JSON.stringify(v);
  let h = 0xcbf29ce484222325n;
  const text = canonical(value);
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}
