import { readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { exists } from '../../utils/filesystem/fs.js';
import { getTargetManagedOutputs } from '../../targets/catalog/builtin-targets.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

async function listFiles(root: string, base = root): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(abs, base)));
      continue;
    }
    files.push(relative(base, abs).replace(/\\/g, '/'));
  }
  return files;
}

async function removeIfStale(
  projectRoot: string,
  relPath: string,
  expected: Set<string>,
): Promise<void> {
  if (expected.has(relPath)) return;
  const abs = join(projectRoot, relPath);
  if (await exists(abs)) await rm(abs, { recursive: true, force: true });
}

export async function cleanupStaleGeneratedOutputs(args: {
  projectRoot: string;
  targets: string[];
  expectedPaths: string[];
  scope?: TargetLayoutScope;
}): Promise<void> {
  const expected = new Set(args.expectedPaths);
  const stale = new Set<string>();
  const scope = args.scope ?? 'project';

  for (const target of args.targets) {
    const managed = getTargetManagedOutputs(target, scope);
    if (!managed) continue;
    for (const file of managed.files) stale.add(file);
    for (const dir of managed.dirs) {
      const absDir = join(args.projectRoot, dir);
      if (!(await exists(absDir))) continue;
      for (const file of await listFiles(absDir)) {
        stale.add(`${dir}/${file}`.replace(/\/+/g, '/'));
      }
    }
  }

  for (const relPath of stale) {
    await removeIfStale(args.projectRoot, relPath, expected);
  }
}
