/**
 * Map install pathInRepo to target hint and whether repo-root discovery + pick inference applies.
 */

import type { ExtendPick } from '../config/schema.js';

/** Longest-match first */
const PATH_PREFIX_TO_TARGET: { prefix: string; target: string }[] = [
  { prefix: '.gemini/commands', target: 'gemini-cli' },
  { prefix: '.github/instructions', target: 'copilot' },
  { prefix: '.github/copilot-instructions.md', target: 'copilot' },
  { prefix: '.github/copilot', target: 'copilot' },
  { prefix: '.github/prompts', target: 'copilot' },
  { prefix: '.github/skills', target: 'copilot' },
  { prefix: '.github/agents', target: 'copilot' },
  { prefix: '.github/hooks', target: 'copilot' },
  { prefix: '.claude/commands', target: 'claude-code' },
  { prefix: '.claude/rules', target: 'claude-code' },
  { prefix: '.claude/skills', target: 'claude-code' },
  { prefix: '.claude/agents', target: 'claude-code' },
  { prefix: '.cursor/commands', target: 'cursor' },
  { prefix: '.cursor/rules', target: 'cursor' },
  { prefix: '.cursor/agents', target: 'cursor' },
  { prefix: '.cursor/skills', target: 'cursor' },
  { prefix: '.continue/prompts', target: 'continue' },
  { prefix: '.continue/rules', target: 'continue' },
  { prefix: '.continue/skills', target: 'continue' },
  { prefix: '.junie/commands', target: 'junie' },
  { prefix: '.junie/rules', target: 'junie' },
  { prefix: '.junie/agents', target: 'junie' },
  { prefix: '.junie/skills', target: 'junie' },
  { prefix: '.cline/skills', target: 'cline' },
  { prefix: '.clinerules/workflows', target: 'cline' },
  { prefix: '.windsurf/rules', target: 'windsurf' },
  { prefix: '.codex', target: 'codex-cli' },
];

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/** Best-effort target id from a native subtree path (for install path scoping). */
export function targetHintFromNativePath(pathInRepoPosix: string): string | undefined {
  const p = norm(pathInRepoPosix);
  const sorted = [...PATH_PREFIX_TO_TARGET].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, target } of sorted) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return target;
  }
  return undefined;
}

/** True when path is under a native layout we can narrow with inferImplicitPickFromNativePath. */
export function pathSupportsNativePick(pathInRepoPosix: string, target: string): boolean {
  const hint = targetHintFromNativePath(pathInRepoPosix);
  return hint === target;
}

export function resolveEffectiveTargetForInstall(args: {
  explicitTarget?: string;
  importHappened: boolean;
  usedTargetFromImport?: string;
  pathInRepoPosix: string;
}): string | undefined {
  if (args.explicitTarget) return args.explicitTarget;
  const hint = args.pathInRepoPosix ? targetHintFromNativePath(args.pathInRepoPosix) : undefined;
  if (hint) return hint;
  if (args.importHappened && args.usedTargetFromImport) return args.usedTargetFromImport;
  return undefined;
}

export function validateTargetMatchesPath(
  explicitTarget: string | undefined,
  pathInRepoPosix: string,
): void {
  if (!explicitTarget || !pathInRepoPosix) return;
  const hint = targetHintFromNativePath(pathInRepoPosix);
  if (hint && hint !== explicitTarget) {
    throw new Error(
      `--target "${explicitTarget}" does not match the install path (native path suggests "${hint}"). ` +
        'Omit --target to auto-detect, or point at a subtree for that target.',
    );
  }
}

export function extendPickHasArrays(p: ExtendPick): boolean {
  return (
    (p.commands?.length ?? 0) +
      (p.rules?.length ?? 0) +
      (p.skills?.length ?? 0) +
      (p.agents?.length ?? 0) >
    0
  );
}
