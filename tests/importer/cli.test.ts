import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck, runImport } from '../../src/importer/cli';
import { html, svg } from './fixture';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'lw-import-test-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
describe('CLI and staged output', () => {
  it('writes deterministic files, re-imports as a no-op, checks its output, and preserves it on failure', async () => {
    const input = join(root, '01fftd.htm'), target = join(root, 'content', '01fftd');
    await writeFile(input, html());
    const first = await runImport([input], root);
    expect(first).toMatchObject({ status: 'written', svg: { status: 'not-run' }, rules: { status: 'not-run' } });
    const names = ['source.htm', 'book.json', 'import-receipt.json'];
    const before = await Promise.all(names.map((n) => readFile(join(target, n))));
    const mtime = (await stat(join(target, 'book.json'))).mtimeMs;
    await expect(runImport([input], root)).resolves.toMatchObject({ status: 'unchanged' });
    expect((await stat(join(target, 'book.json'))).mtimeMs).toBe(mtime);
    await expect(runCheck([join(target, 'book.json')])).resolves.toMatchObject({ graph: { ok: true }, svg: { status: 'not-run' } });
    await writeFile(input, html().replace('id="sect2"', 'id="sect1"'));
    await expect(runImport([input], root)).rejects.toThrow();
    expect(await Promise.all(names.map((n) => readFile(join(target, n))))).toEqual(before);
    await writeFile(input, html());
    const badGraph = join(root, 'test.svg'); await writeFile(badGraph, svg(['1->350']));
    await expect(runImport([input, '--svg', badGraph], root)).rejects.toThrow(/SVG mismatch/);
    expect(await Promise.all(names.map((n) => readFile(join(target, n))))).toEqual(before);
    await writeFile(join(target, 'kept.txt'), 'user-owned test file');
    await writeFile(input, `${html()}\n`);
    await expect(runImport([input], root)).resolves.toMatchObject({ status: 'written' });
    expect(await readFile(join(target, 'kept.txt'), 'utf8')).toBe('user-owned test file');
  });
  it('rejects invalid options and broken supplied rules before publication', async () => {
    const input = join(root, '01fftd.htm'); await writeFile(input, html());
    await expect(runImport([input, '--svg'], root)).rejects.toThrow(/missing value/);
    await expect(runImport([input, '--what', 'x'], root)).rejects.toThrow(/unknown/);
    const rules = join(root, 'rules.json'); await writeFile(rules, '{}');
    await expect(runImport([input, '--rules', rules], root)).rejects.toThrow();
    await expect(stat(join(root, 'content', '01fftd'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
