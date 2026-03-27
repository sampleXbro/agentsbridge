import {
  buildClaudeCodeImportPaths,
  buildCursorImportPaths,
  buildCopilotImportPaths,
  buildContinueImportPaths,
  buildJunieImportPaths,
  buildGeminiCliImportPaths,
  buildClineImportPaths,
  buildCodexCliImportPaths,
  buildWindsurfImportPaths,
} from './import-map-targets.js';

export async function buildImportReferenceMap(
  target: string,
  projectRoot: string,
): Promise<Map<string, string>> {
  const refs = new Map<string, string>();

  if (target === 'claude-code') {
    await buildClaudeCodeImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'cursor') {
    await buildCursorImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'copilot') {
    await buildCopilotImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'continue') {
    await buildContinueImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'junie') {
    await buildJunieImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'gemini-cli') {
    await buildGeminiCliImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'cline') {
    await buildClineImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'codex-cli') {
    await buildCodexCliImportPaths(refs, projectRoot);
    return refs;
  }
  if (target === 'windsurf') {
    await buildWindsurfImportPaths(refs, projectRoot);
    return refs;
  }

  return refs;
}
