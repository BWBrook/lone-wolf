import { describe, expect, it } from 'vitest';
import { buildEngineBook } from '../../src/engine';
import { book, imported, rules } from './fixture';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const build = (patchRules: (r: any) => void = () => {}, patchBook: (b: any) => void = () => {}) => {
  const r = clone(rules);
  const b = clone(imported);
  patchRules(r);
  patchBook(b);
  return () => buildEngineBook(b, r);
};

describe('buildEngineBook', () => {
  it('builds the fixture with every section reviewed', () => {
    expect(book.unreviewed).toEqual([]);
    expect(Object.keys(book.sections)).toHaveLength(12);
  });

  it('refuses unreviewed sections unless deliberately allowed', () => {
    const r = clone(rules) as any;
    delete r.sections['6'];
    expect(() => buildEngineBook(imported, r)).toThrow(/sections without rules: 6/);
    expect(buildEngineBook(imported, r, { allowUnreviewed: true }).unreviewed).toEqual([6]);
  });

  it.each([
    ['an unknown item', (r: any) => r.sections['4'].effects[0].items.push('lantern'), /unknown item lantern/],
    ['an inherited property as an item', (r: any) => r.sections['4'].effects[0].items.push('constructor'), /unknown item constructor/],
    ['a missing combat', (r: any) => (r.sections['2'].effects[0].combat = 1), /no combat 1/],
    ['a missing evade choice', (r: any) => (r.sections['2'].effects[0].evade.choice = 9), /evade choice 9/],
    ['a missing choice', (r: any) => (r.sections['1'].choices['7'] = {}), /choice 7 does not exist/],
    ['rules for a missing section', (r: any) => (r.sections['99'] = {}), /section 99/],
    ['an unimplemented hook', (r: any) => (r.sections['7'].effects = [{ op: 'hook', name: 'x' }]), /hook x/],
    ['the wrong book', (r: any) => (r.book = 'other'), /rules are for other/],
  ])('rejects %s in the rules', (_, patch, message) => {
    expect(build(patch)).toThrow(message);
  });

  it.each([
    ['a choice to a missing section', (b: any) => (b.sections[0].choices[0].target = 999), /targets missing section 999/],
    ['a missing start section', (b: any) => b.sections.shift(), /start section 1/],
    ['duplicate choice ordinals', (b: any) => (b.sections[0].choices[1].ordinal = 1), /duplicate choice ordinals/],
    ['a duplicated section', (b: any) => b.sections.push(clone(b.sections[2])), /section 3 appears twice/],
    ['a dead end with choices', (b: any) => b.sections[6].choices.push({ ordinal: 1, target: 1 }), /dead end with choices/],
  ])('rejects %s in the imported book', (_, patch, message) => {
    expect(build(() => {}, patch)).toThrow(message);
  });

  it('rejects malformed rules data', () => {
    expect(build((r) => (r.sections['3'].effects[0] = { op: 'teleport' }))).toThrow();
    expect(build((r) => (r.sections['3'].effects[0].prose = 'text'))).toThrow();
    expect(build((r) => (r.setup.disciplines = 11))).toThrow();
    expect(build((r) => (r.sections['8'].choices['1'].when = { gold: { min: 6, max: 5 } }))).toThrow(/range min exceeds max/);
  });

  it('fingerprints the rules so saves can detect a change', () => {
    expect(book.rulesFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(build((r) => (r.setup.goldBase = 10))().rulesFingerprint).not.toBe(book.rulesFingerprint);
    expect(build()().rulesFingerprint).toBe(book.rulesFingerprint);
  });
});
