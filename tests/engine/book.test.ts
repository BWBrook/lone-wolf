import { describe, expect, it } from 'vitest';
import { buildEngineBook } from '../../src/engine';
import { book, imported, rules } from './fixture';

const withRules = (patch: (r: typeof rules & Record<string, any>) => void) => {
  const r = JSON.parse(JSON.stringify(rules));
  patch(r);
  return () => buildEngineBook(imported, r);
};

describe('buildEngineBook', () => {
  it('builds the fixture with every section reviewed', () => {
    expect(book.unreviewed).toEqual([]);
    expect(Object.keys(book.sections)).toHaveLength(11);
  });

  it('lists sections without rules as unreviewed', () => {
    const r = JSON.parse(JSON.stringify(rules));
    delete r.sections['6'];
    expect(buildEngineBook(imported, r).unreviewed).toEqual([6]);
  });

  it.each([
    ['an unknown item', (r: any) => r.sections['4'].effects[0].items.push('lantern'), /unknown item lantern/],
    ['a missing combat', (r: any) => (r.sections['2'].effects[0].combat = 1), /no combat 1/],
    ['a missing evade choice', (r: any) => (r.sections['2'].effects[0].evade.choice = 9), /evade choice 9/],
    ['a missing choice', (r: any) => (r.sections['1'].choices['7'] = {}), /choice 7 does not exist/],
    ['rules for a missing section', (r: any) => (r.sections['99'] = {}), /section 99/],
    ['an unimplemented hook', (r: any) => (r.sections['7'].effects = [{ op: 'hook', name: 'x' }]), /hook x/],
    ['the wrong book', (r: any) => (r.book = 'other'), /rules are for other/],
  ])('rejects %s', (_, patch, message) => {
    expect(withRules(patch)).toThrow(message);
  });

  it('rejects malformed rules data', () => {
    expect(withRules((r: any) => (r.sections['3'].effects[0] = { op: 'teleport' }))).toThrow();
    expect(withRules((r: any) => (r.sections['3'].effects[0].prose = 'text'))).toThrow();
  });
});
