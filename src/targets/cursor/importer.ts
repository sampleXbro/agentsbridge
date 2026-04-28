/**
 * Cursor target importer.
 *
 * Project scope:
 *  - Rules: stays imperative — `.cursor/rules/*.mdc` uses cross-iteration
 *    `alwaysApply` state to promote one entry to the canonical root, with
 *    fallback chains through `AGENTS.md` and `.cursorrules` (which feed the
 *    embedded-rule splitter). Not declarable through the runner today.
 *  - Skills: imperative (`.cursor/skills/*.md` flat → directory rename).
 *  - MCP: imperative (writes the source JSON verbatim to preserve fields the
 *    runner's `mcpJson` parser would drop, e.g. `disabledMcpjsonServers`).
 *  - Settings: imperative (extracts `permissions` out of `.cursor/settings.json`).
 *  - Ignore: imperative (merges `.cursorignore` + `.cursorindexingignore` into
 *    one deduped list — the runner's `flatFile` mode does not model merge).
 *  - Commands / Agents: declared on the descriptor.
 *
 * Global scope: dispatched to a separate code path
 * (`importFromCursorGlobalExports`) — entirely different on-disk layout.
 */

import { dirname, join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { mkdirp, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { importCursorRules } from './importer-rules.js';
import { importIgnore, importSettings } from './settings-helpers.js';
import { importSkills } from './skills-adapter.js';
import { importFromCursorGlobalExports } from './import-global-exports.js';
import { CURSOR_MCP, CURSOR_CANONICAL_MCP } from './constants.js';
import { descriptor } from './index.js';

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const mcpPath = join(projectRoot, CURSOR_MCP);
  const content = await readFileSafe(mcpPath);
  if (!content) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object' || !('mcpServers' in (parsed as object))) return;
  const destPath = join(projectRoot, CURSOR_CANONICAL_MCP);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: 'cursor',
    fromPath: mcpPath,
    toPath: CURSOR_CANONICAL_MCP,
    feature: 'mcp',
  });
}

export async function importFromCursor(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  if (options.scope === 'global') {
    return importFromCursorGlobalExports(projectRoot);
  }
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer('cursor', projectRoot);
  await importCursorRules(projectRoot, results, normalize);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, 'project', { normalize })));
  await importSkills(projectRoot, results, normalize);
  await importMcp(projectRoot, results);
  await importSettings(projectRoot, results);
  await importIgnore(projectRoot, results);
  return results;
}
