/**
 * Copilot hook parsing helpers — event mapping, wrapper command extraction, and hook import.
 */

import { join, dirname, basename } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { stringify as yamlStringify } from 'yaml';
import {
  COPILOT_TARGET,
  COPILOT_HOOKS_DIR,
  COPILOT_CANONICAL_HOOKS,
  COPILOT_LEGACY_HOOKS_DIR,
} from './constants.js';

export function mapCopilotHookEvent(event: string): string | null {
  switch (event) {
    case 'preToolUse':
      return 'PreToolUse';
    case 'postToolUse':
      return 'PostToolUse';
    case 'notification':
      return 'Notification';
    case 'userPromptSubmitted':
      return 'UserPromptSubmit';
    default:
      return null;
  }
}

export function extractMatcher(comment: unknown): string {
  if (typeof comment !== 'string') return '*';
  const match = comment.match(/^Matcher:\s*(.+)$/);
  return match?.[1]?.trim() || '*';
}

export function extractWrapperCommand(content: string): string {
  const metadataMatch = content.match(/^# agentsmesh-command:\s*(.+)$/m);
  if (metadataMatch?.[1]) return metadataMatch[1].trim();
  return content
    .replace(/^#!.*\n/, '')
    .replace(/^#.*\n/gm, '')
    .replace(/^HOOK_DIR=.*\n/gm, '')
    .replace(/^set -e\n?/m, '')
    .trim();
}

/**
 * Import Copilot hook JSON configs (.github/hooks/*.json) into canonical hooks.yaml.
 * Also supports legacy .github/copilot-hooks/*.sh wrappers for backwards compatibility.
 */
export async function importHooks(projectRoot: string, results: ImportResult[]): Promise<void> {
  const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
  const allFiles = await readDirRecursive(hooksDir).catch(() => []);
  const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));
  const hooks: Record<string, Array<{ matcher: string; command: string; type: string }>> = {};

  for (const srcPath of jsonFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.hooks !== 'object' || parsed.hooks === null) continue;
    for (const [event, entries] of Object.entries(parsed.hooks as Record<string, unknown>)) {
      const canonicalEvent = mapCopilotHookEvent(event);
      if (!canonicalEvent || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const entryRecord = entry as Record<string, unknown>;
        const bashPath = typeof entryRecord.bash === 'string' ? entryRecord.bash : '';
        if (!bashPath) continue;
        const scriptPath = join(hooksDir, bashPath.replace(/^\.\//, ''));
        const scriptContent = await readFileSafe(scriptPath);
        if (!scriptContent) continue;
        const command = extractWrapperCommand(scriptContent);
        if (!command) continue;
        if (!hooks[canonicalEvent]) hooks[canonicalEvent] = [];
        hooks[canonicalEvent]!.push({
          matcher: extractMatcher(entryRecord.comment),
          command,
          type: 'command',
        });
      }
    }
  }

  const legacyDir = join(projectRoot, COPILOT_LEGACY_HOOKS_DIR);
  const legacyFiles = await readDirRecursive(legacyDir).catch(() => []);
  const shFiles = legacyFiles.filter(
    (file) => dirname(file) === legacyDir && /^[^-]+-\d+\.sh$/i.test(basename(file)),
  );
  for (const srcPath of shFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const name = basename(srcPath, '.sh');
    const dashIdx = name.lastIndexOf('-');
    const phase = dashIdx > 0 ? name.slice(0, dashIdx) : name;
    if (!hooks[phase]) hooks[phase] = [];
    hooks[phase]!.push({ matcher: '*', command: extractWrapperCommand(content), type: 'command' });
  }

  if (Object.keys(hooks).length === 0) return;

  const destPath = join(projectRoot, COPILOT_CANONICAL_HOOKS);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, yamlStringify(hooks));
  results.push({
    fromTool: COPILOT_TARGET,
    fromPath: join(projectRoot, COPILOT_HOOKS_DIR),
    toPath: COPILOT_CANONICAL_HOOKS,
    feature: 'hooks',
  });
}
