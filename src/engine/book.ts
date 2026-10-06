import { BookRules, type Condition, type Effect } from './rules';
import type { EngineBook, EngineSection, ImportedBook } from './types';

// Combine an imported book with our rules data. Throws on any broken reference;
// sections without a rules entry are listed in `unreviewed`, never silently trusted.
export function buildEngineBook(imported: ImportedBook, rulesData: unknown): EngineBook {
  const rules = BookRules.parse(rulesData);
  const problems: string[] = [];
  if (rules.book !== imported.id) problems.push(`rules are for ${rules.book}, book is ${imported.id}`);

  const sections: Record<number, EngineSection> = {};
  for (const s of imported.sections) sections[s.number] = { ...s, rules: rules.sections[String(s.number)] ?? {} };
  if (!sections[rules.finalSection]) problems.push(`final section ${rules.finalSection} does not exist`);

  const item = (where: string, id: string) => {
    if (!rules.items[id]) problems.push(`${where}: unknown item ${id}`);
  };
  const condition = (where: string, c: Condition): void => {
    if ('item' in c) item(where, c.item);
    else if ('visited' in c && !sections[c.visited]) problems.push(`${where}: unknown section ${c.visited}`);
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

  if (problems.length) throw new Error(`invalid rules for ${imported.id}:\n${problems.join('\n')}`);
  return {
    id: imported.id,
    sourceSha256: imported.sourceSha256,
    finalSection: rules.finalSection,
    items: rules.items,
    setup: rules.setup,
    sections,
    unreviewed: imported.sections.map((s) => s.number).filter((n) => !rules.sections[String(n)]),
  };
}
