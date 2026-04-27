/**
 * Single registry of targets that must have global-mode import/generate round-trip e2e coverage.
 * Keep in sync with {@link TARGET_IDS} entries that expose {@code descriptor.globalSupport}.
 */

export const GLOBAL_ROUNDTRIP_E2E_TARGET_IDS = [
  'antigravity',
  'claude-code',
  'cline',
  'codex-cli',
  'continue',
  'copilot',
  'cursor',
  'gemini-cli',
  'junie',
  'kiro',
  'roo-code',
  'windsurf',
] as const;
