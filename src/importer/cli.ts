import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseBook } from './parse';
import { checkGraph, checkRules, compareSvg } from './graph';
import { loadSource, readBounded, sha256, decode } from './source';
import { publish, stableJson } from './output';
import type { ImportedBook } from '../engine/types';

function options(args: string[]): { input: string; svg?: string; rules?: string } {
  const [input, ...rest] = args;
  if (!input || input.startsWith('--')) throw new Error('usage: <input> [--svg <local-path-or-url>] [--rules <path>]');
  const result: { input: string; svg?: string; rules?: string } = { input };
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i], value = rest[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${option}`);
    if (option === '--svg' && !result.svg) result.svg = value;
    else if (option === '--rules' && !result.rules) result.rules = value;
    else throw new Error(`unknown or duplicate option: ${option}`);
  }
  return result;
}
export async function runImport(args: string[], root = process.cwd()): Promise<object> {
  const argsParsed = options(args), source = await loadSource(argsParsed.input), book = parseBook(source);
  const graph = checkGraph(book);
  const svg = argsParsed.svg ? compareSvg(book, await readBounded(argsParsed.svg)) : { status: 'not-run' as const };
  if (svg.status === 'failed') throw new Error(`SVG mismatch: missing ${svg.missing.length}, extra ${svg.extra.length}`);
  if (argsParsed.rules) checkRules(book, JSON.parse(decode(await readBounded(argsParsed.rules))));
  const bookJson = stableJson(book);
  const receipt = {
    formatVersion: 1, book: book.id, sourceSha256: book.sourceSha256,
    inputSha256: book.source.archiveSha256 ?? book.sourceSha256,
    archiveSha256: book.source.archiveSha256, entryPath: book.source.entryPath,
    bookJsonSha256: sha256(bookJson),
    counts: { ...graph.counts, footnotes: book.footnotes.length, illustrations: book.illustrations.length },
    graph, svg,
    rules: argsParsed.rules ? { status: 'passed' as const } : { status: 'not-run' as const },
  };
  const status = await publish(root, {
    'source.htm': source.bytes, 'book.json': Buffer.from(bookJson),
    'import-receipt.json': Buffer.from(stableJson(receipt)),
  });
  return { status, output: 'content/01fftd/book.json', ...receipt };
}
export async function runCheck(args: string[]): Promise<object> {
  const argsParsed = options(args);
  const book = JSON.parse(decode(await readBounded(argsParsed.input))) as ImportedBook;
  if (book.id !== '01fftd') throw new Error('checker supports Book 1 only');
  const graph = checkGraph(book);
  const svg = argsParsed.svg ? compareSvg(book, await readBounded(argsParsed.svg)) : { status: 'not-run' as const };
  if (!graph.ok || svg.status === 'failed') throw new Error(stableJson({ graph, svg }));
  if (argsParsed.rules) checkRules(book, JSON.parse(decode(await readBounded(argsParsed.rules))));
  return { graph, svg, rules: { status: argsParsed.rules ? 'passed' : 'not-run' } };
}
// Check the entrypoint without changing the engine's bundler-style imports.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), checking = args[0] === 'check';
  try { console.log(stableJson(await (checking ? runCheck(args.slice(1)) : runImport(args)))); }
  catch (error) { console.error(`importer: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
}
