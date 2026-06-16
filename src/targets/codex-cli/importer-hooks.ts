import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, mkdirp, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { CODEX_CANONICAL_HOOKS, CODEX_HOOKS_FILE, CODEX_TARGET } from './constants.js';

interface ImportedHook {
  matcher: string;
  command: string;
  type: 'command';
  timeout?: number;
}

export async function importCodexHooks(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const srcPath = join(projectRoot, CODEX_HOOKS_FILE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const rawHooks = (parsed as Record<string, unknown>).hooks;
  if (!rawHooks || typeof rawHooks !== 'object' || Array.isArray(rawHooks)) return;
  const hooks: Record<string, ImportedHook[]> = {};
  for (const [event, groups] of Object.entries(rawHooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group || typeof group !== 'object') continue;
      const record = group as Record<string, unknown>;
      const matcher = typeof record.matcher === 'string' ? record.matcher : '*';
      if (!Array.isArray(record.hooks)) continue;
      for (const raw of record.hooks) {
        if (!raw || typeof raw !== 'object') continue;
        const hook = raw as Record<string, unknown>;
        if (hook.type !== 'command' || typeof hook.command !== 'string') continue;
        const imported: ImportedHook = { matcher, command: hook.command, type: 'command' };
        if (typeof hook.timeout === 'number') imported.timeout = hook.timeout;
        (hooks[event] ??= []).push(imported);
      }
    }
  }
  if (Object.keys(hooks).length === 0) return;
  const destPath = join(projectRoot, CODEX_CANONICAL_HOOKS);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, stringifyYaml(hooks));
  results.push({
    fromTool: CODEX_TARGET,
    fromPath: srcPath,
    toPath: CODEX_CANONICAL_HOOKS,
    feature: 'hooks',
  });
}
