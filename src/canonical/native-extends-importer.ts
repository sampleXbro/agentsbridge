import type { ImportResult } from '../core/result-types.js';
import { importFromClaudeCode } from '../targets/claude-code/importer.js';
import { importFromCursor } from '../targets/cursor/importer.js';
import { importFromCopilot } from '../targets/copilot/importer.js';
import { importFromGemini } from '../targets/gemini-cli/importer.js';
import { importFromCodex } from '../targets/codex-cli/importer.js';
import { importFromWindsurf } from '../targets/windsurf/importer.js';
import { importFromCline } from '../targets/cline/importer.js';
import { importFromContinue } from '../targets/continue/importer.js';
import { importFromJunie } from '../targets/junie/importer.js';

type ImportFn = (projectRoot: string) => Promise<ImportResult[]>;

const NATIVE_IMPORTERS: Record<string, ImportFn> = {
  'claude-code': importFromClaudeCode,
  cursor: importFromCursor,
  copilot: importFromCopilot,
  'gemini-cli': importFromGemini,
  'codex-cli': importFromCodex,
  windsurf: importFromWindsurf,
  cline: importFromCline,
  continue: importFromContinue,
  junie: importFromJunie,
};

/**
 * Import native agent format files from repoPath into repoPath/.agentsbridge/.
 * Uses the registered importer for the given targetName.
 *
 * @param repoPath - Absolute path to the fetched/cloned repo root
 * @param targetName - Detected target format identifier (e.g. 'claude-code')
 * @returns Import results from the importer
 * @throws Error if no importer is registered for the given target name
 */
export async function importNativeToCanonical(
  repoPath: string,
  targetName: string,
): Promise<ImportResult[]> {
  const importFn = NATIVE_IMPORTERS[targetName];
  if (!importFn) {
    throw new Error(`No importer registered for native target: ${targetName}`);
  }
  return importFn(repoPath);
}
