/**
 * Standalone target ID constants.
 *
 * Extracted from builtin-targets.ts to break a circular type dependency:
 * schema.ts → builtin-targets.ts → descriptors → ValidatedConfig → schema.ts
 *
 * When adding a new target, add its ID here AND its descriptor to
 * BUILTIN_TARGETS in builtin-targets.ts. A compile-time assertion
 * in builtin-targets.ts ensures they stay in sync.
 */

export const TARGET_IDS = [
  'claude-code',
  'cursor',
  'copilot',
  'continue',
  'junie',
  'kiro',
  'gemini-cli',
  'cline',
  'codex-cli',
  'windsurf',
  'antigravity',
  'roo-code',
] as const;

export type BuiltinTargetId = (typeof TARGET_IDS)[number];

/** Codex CLI id — shared skill dirs and AGENTS.md collision policy reference this explicitly. */
export const CODEX_CLI_TARGET_ID = 'codex-cli' satisfies BuiltinTargetId;

export function isBuiltinTargetId(value: string): value is BuiltinTargetId {
  return (TARGET_IDS as readonly string[]).includes(value);
}
