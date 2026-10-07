import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Sorted object keys; arrays retain source order. No timestamps enter book.json.
export function stableJson(value: unknown): string {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted)
    : v !== null && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, sorted((v as Record<string, unknown>)[key])])) : v;
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function directory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`expected a real directory: ${path}`);
}

// Publish a complete staged directory, with rollback if the second rename fails.
// Retain other locally held files (e.g. later artwork) rather than deleting them.
export async function publish(root: string, files: Record<string, Uint8Array>): Promise<'written' | 'unchanged'> {
  const content = join(root, 'content'), target = join(content, '01fftd');
  await mkdir(content, { recursive: true });
  await directory(content);
  const previous = await exists(target);
  if (previous) {
    await directory(target);
    let same = true;
    for (const [name, bytes] of Object.entries(files)) {
      const file = join(target, name);
      if (!await exists(file)) { same = false; break; }
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`expected a regular output file: ${file}`);
      if (!Buffer.from(bytes).equals(await readFile(file))) { same = false; break; }
    }
    if (same) return 'unchanged';
  }
  const stage = await mkdtemp(join(content, '.01fftd-stage-'));
  const backup = `${stage}-previous`;
  let backedUp = false;
  try {
    if (previous) await cp(target, stage, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
      // Only these fixed importer filenames may be replaced. Unlink a staged
      // old file first so an existing symlink cannot redirect a write.
      if (!['source.htm', 'book.json', 'import-receipt.json'].includes(name)) throw new Error('unsupported output filename');
      const destination = join(stage, name);
      if (await exists(destination)) await unlink(destination);
      await writeFile(destination, bytes, { flag: 'wx' });
    }
    if (previous) { await rename(target, backup); backedUp = true; }
    try { await rename(stage, target); }
    catch (error) {
      if (backedUp) { await rename(backup, target); backedUp = false; }
      throw error;
    }
    // Publication has succeeded. Failed backup cleanup must not report the
    // import as failed after replacing it; the old directory remains recoverable.
    if (backedUp) { await rm(backup, { recursive: true }).catch(() => {}); backedUp = false; }
    return 'written';
  } finally {
    await rm(stage, { recursive: true, force: true });
    // If rollback itself fails, keep the backup for recovery; never destroy it.
  }
}
