/**
 * agentsmesh init — create agentsmesh.yaml and .agentsmesh/ scaffold.
 * With --yes: auto-import detected configs, then add example scaffold only where canonical paths stayed empty.
 */

import { join, relative } from 'node:path';
import { exists, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { BUILTIN_TARGETS } from '../../targets/catalog/builtin-targets.js';
import type { ImportResult } from '../../core/types.js';
import { buildConfig, LOCAL_TEMPLATE } from './init-templates.js';
import { detectExistingConfigs } from './init-detect.js';
import { writeScaffoldFull, writeScaffoldGapFill } from './init-scaffold.js';
import { resolveScopeContext, type ConfigScope } from '../../config/core/scope.js';
import type { BuiltinTargetId } from '../../targets/catalog/target-ids.js';
import type { InitData } from '../command-result.js';

export interface InitCommandResult {
  exitCode: number;
  data: InitData;
}

const CONFIG_FILENAME = 'agentsmesh.yaml';
const LOCAL_CONFIG_FILENAME = 'agentsmesh.local.yaml';
// Packs are materialized derivatives of installs.yaml — same model as node_modules.
// `agentsmesh install --sync` reproduces them deterministically post-clone.
// Generated target folders (.claude/, .cursor/, .github/, .gemini/, etc.) are NOT
// in this list — they are committed by default so fresh clones have AI configs
// available without a build step. Use `agentsmesh check` in CI to detect drift.
const GITIGNORE_ENTRIES = [
  'agentsmesh.local.yaml',
  '.agentsmeshcache',
  '.agentsmesh/.lock.tmp',
  '.agentsmesh/packs/',
];

/** Importers derived from target descriptors — no manual registration needed. */
const IMPORTERS: Record<string, (root: string, scope: ConfigScope) => Promise<ImportResult[]>> =
  Object.fromEntries(
    BUILTIN_TARGETS.map((d) => [
      d.id,
      (root: string, scope: ConfigScope) => d.generators.importFrom(root, { scope }),
    ]),
  );
const GLOBAL_INIT_TARGETS: BuiltinTargetId[] = BUILTIN_TARGETS.filter(
  (target) => target.globalSupport !== undefined,
).map((target) => target.id as BuiltinTargetId);

/**
 * Append entries to .gitignore unless an existing entry already covers them.
 *
 * Coverage rules: an existing line covers a candidate when it is the same
 * string (after trim) or when it is a broader pattern that ignores the
 * candidate's parent directory (e.g. `.agentsmesh/` covers `.agentsmesh/.lock.tmp`
 * and `.agentsmesh/packs/`). This prevents redundant child entries when users
 * already gitignore the whole canonical tree.
 */
function isCoveredByExisting(candidate: string, existing: ReadonlySet<string>): boolean {
  if (existing.has(candidate)) return true;
  // A broader entry like `.agentsmesh/` or `.agentsmesh` covers any descendant.
  let parent = candidate.replace(/\/$/, '');
  while (parent.includes('/')) {
    parent = parent.slice(0, parent.lastIndexOf('/'));
    if (parent === '') break;
    if (existing.has(parent) || existing.has(`${parent}/`) || existing.has(`${parent}/**`)) {
      return true;
    }
  }
  return false;
}

async function appendToGitignore(projectRoot: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const current = (await readFileSafe(gitignorePath)) ?? '';
  const lines = new Set(
    current
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#')),
  );
  const toAdd = GITIGNORE_ENTRIES.filter((e) => !isCoveredByExisting(e, lines));
  if (toAdd.length === 0) return false;
  const suffix = current.endsWith('\n') || current === '' ? '' : '\n';
  await writeFileAtomic(gitignorePath, current + suffix + toAdd.join('\n') + '\n');
  return true;
}

export { detectExistingConfigs };

/**
 * Run the init command.
 * @param projectRoot - Project root (default process.cwd())
 * @param options - Optional flags: yes (auto-import without prompting)
 * @throws Error if already initialized
 */
export async function runInit(
  projectRoot: string,
  options: { yes?: boolean; global?: boolean } = {},
): Promise<InitCommandResult> {
  const scope: ConfigScope = options.global === true ? 'global' : 'project';
  const context = resolveScopeContext(projectRoot, scope);
  const configPath = join(context.configDir, CONFIG_FILENAME);
  if (await exists(configPath)) {
    throw new Error(`Already initialized. ${CONFIG_FILENAME} exists. Remove it first to re-init.`);
  }

  const detected = await detectExistingConfigs(context.rootBase, scope);
  const existing =
    scope === 'global'
      ? detected.filter((target): target is BuiltinTargetId =>
          GLOBAL_INIT_TARGETS.includes(target as BuiltinTargetId),
        )
      : detected;
  const defaultTargets = scope === 'global' ? GLOBAL_INIT_TARGETS : undefined;

  const imported: Array<{ from: string; to: string }> = [];
  let scaffoldType: 'full' | 'gap-fill' | 'none';
  let importedToolCount = 0;

  if (existing.length > 0) {
    if (options.yes) {
      for (const toolId of existing) {
        const importerFn = IMPORTERS[toolId];
        if (!importerFn) continue;
        const results = await importerFn(context.rootBase, scope);
        for (const r of results) {
          imported.push({
            from: relative(context.rootBase, r.fromPath).replaceAll('\\', '/'),
            to: r.toPath.replaceAll('\\', '/'),
          });
        }
      }
      importedToolCount = existing.length;

      await writeScaffoldGapFill(context.canonicalDir);
      scaffoldType = 'gap-fill';
      await writeFileAtomic(configPath, buildConfig(existing, defaultTargets));
    } else {
      await writeScaffoldFull(context.canonicalDir);
      scaffoldType = 'full';
      await writeFileAtomic(configPath, buildConfig([], defaultTargets));
    }
  } else {
    await writeScaffoldFull(context.canonicalDir);
    scaffoldType = 'full';
    await writeFileAtomic(configPath, buildConfig([], defaultTargets));
  }

  const localPath = join(context.configDir, LOCAL_CONFIG_FILENAME);
  await writeFileAtomic(localPath, LOCAL_TEMPLATE);

  let gitignoreUpdated = false;
  if (scope === 'project') {
    gitignoreUpdated = await appendToGitignore(projectRoot);
  }

  return {
    exitCode: 0,
    data: {
      scope,
      configFile: CONFIG_FILENAME,
      localConfigFile: LOCAL_CONFIG_FILENAME,
      detectedConfigs: existing,
      imported,
      importedToolCount,
      scaffoldType,
      gitignoreUpdated,
    },
  };
}
