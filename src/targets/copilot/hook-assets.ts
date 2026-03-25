import { join, relative } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { readFileSafe } from '../../utils/fs.js';
import { COPILOT_HOOKS_DIR } from './constants.js';
import type { RulesOutput } from './generator.js';
import { hasHookCommand } from './hook-entry.js';

const SCRIPT_PREFIX_RE =
  /^(?<prefix>\s*(?:(?:bash|sh|zsh)\s+)?)["']?(?<path>(?:\.\.\/|\.\/|[^/\s"'`]+\/)[^\s"'`]+)["']?(?<suffix>(?:\s.*)?)$/;

function safePhaseName(phase: string): string {
  return phase.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function toRepoRelative(projectRoot: string, sourcePath: string): string | null {
  const repoRelative = relative(projectRoot, sourcePath).replace(/\\/g, '/');
  if (!repoRelative || repoRelative.startsWith('../')) return null;
  return repoRelative;
}

function rewriteWrapperCommand(command: string, assetRelativePath: string): string {
  const match = command.match(SCRIPT_PREFIX_RE);
  if (!match?.groups) return command;
  const prefix = match.groups['prefix'] ?? '';
  const suffix = match.groups['suffix'] ?? '';
  return `${prefix}"$HOOK_DIR/${assetRelativePath}"${suffix}`;
}

async function buildAssetOutput(
  projectRoot: string,
  command: string,
): Promise<{ assetPath: string; content: string; rewrittenCommand: string } | null> {
  const match = command.match(SCRIPT_PREFIX_RE);
  const sourceToken = match?.groups?.['path'];
  if (!sourceToken) return null;

  const sourcePath = join(projectRoot, sourceToken);
  const assetContent = await readFileSafe(sourcePath);
  if (assetContent === null) return null;

  const repoRelative = toRepoRelative(projectRoot, sourcePath);
  if (!repoRelative) return null;

  return {
    assetPath: `${COPILOT_HOOKS_DIR}/scripts/${repoRelative}`,
    content: assetContent,
    rewrittenCommand: rewriteWrapperCommand(command, repoRelative),
  };
}

function wrapperPath(event: string, index: number): string {
  return `${COPILOT_HOOKS_DIR}/scripts/${safePhaseName(event)}-${index}.sh`;
}

function buildWrapper(command: string, matcher: string): string {
  return [
    '#!/usr/bin/env bash',
    `# agentsbridge-matcher: ${matcher}`,
    `# agentsbridge-command: ${command}`,
    'set -e',
    command,
    '',
  ].join('\n');
}

export async function addHookScriptAssets(
  projectRoot: string,
  canonical: CanonicalFiles,
  outputs: RulesOutput[],
): Promise<RulesOutput[]> {
  if (!canonical.hooks) return outputs;

  const wrapperOutputs: RulesOutput[] = [];
  const assetOutputs = new Map<string, RulesOutput>();

  for (const [event, entries] of Object.entries(canonical.hooks)) {
    if (!Array.isArray(entries)) continue;
    let index = 0;
    for (const entry of entries) {
      if (!hasHookCommand(entry)) continue;
      const scriptPath = wrapperPath(event, index);
      let command = entry.command;
      const asset = await buildAssetOutput(projectRoot, entry.command);
      if (asset) {
        command = asset.rewrittenCommand;
        if (!assetOutputs.has(asset.assetPath)) {
          assetOutputs.set(asset.assetPath, { path: asset.assetPath, content: asset.content });
        }
      }

      const wrapper = buildWrapper(command, entry.matcher).replace(
        'set -e\n',
        'set -e\nHOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"\n',
      );
      wrapperOutputs.push({ path: scriptPath, content: wrapper });
      index++;
    }
  }

  return [...outputs, ...wrapperOutputs, ...assetOutputs.values()];
}
