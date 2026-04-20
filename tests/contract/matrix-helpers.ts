import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function listFilesRecursive(dir: string, base = ''): string[] {
  const root = base ? join(dir, base) : dir;
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listFilesRecursive(dir, rel);
    return [rel];
  });
}

export function generatedPathsOnDisk(projectRoot: string): string[] {
  return listFilesRecursive(projectRoot)
    .filter((file) => file !== 'agentsmesh.yaml')
    .filter((file) => !file.startsWith('.agentsmesh/'))
    .filter((file) => !file.startsWith('.agentsmeshcache'))
    .filter((file) => !file.startsWith('docs/'))
    .sort();
}

export function canonicalPathsOnDisk(projectRoot: string): string[] {
  return listFilesRecursive(join(projectRoot, '.agentsmesh'))
    .map((file) => `.agentsmesh/${file}`)
    .sort();
}
