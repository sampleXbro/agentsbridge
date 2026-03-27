import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(root: string, base = ''): string[] {
  const current = base ? join(root, base) : root;
  const entries = readdirSync(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...walk(root, rel));
      continue;
    }
    files.push(rel);
  }
  return files.sort();
}

export function snapshotProject(
  dir: string,
  options: { ignore?: string[] } = {},
): Record<string, string> {
  const ignore = options.ignore ?? ['.agentsmesh/.lock', '.agentsmeshcache'];
  const state: Record<string, string> = {};
  for (const rel of walk(dir)) {
    if (ignore.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
    state[rel] = readFileSync(join(dir, rel), 'utf-8');
  }
  return state;
}

export function listRelativeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return walk(dir);
}
