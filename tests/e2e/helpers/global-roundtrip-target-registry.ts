/**
 * Single registry of targets that must have global-mode import/generate round-trip e2e coverage.
 * Keep in sync with {@link TARGET_IDS} entries that expose {@code descriptor.globalSupport}.
 */

export const GLOBAL_ROUNDTRIP_E2E_TARGET_IDS = [
  'aider',
  'amazon-q',
  'amp',
  'antigravity',
  'augment-code',
  'claude-code',
  'cline',
  'codex-cli',
  'continue',
  'copilot',
  'crush',
  'cursor',
  'gemini-cli',
  'goose',
  'junie',
  'kilo-code',
  'kiro',
  'opencode',
  'qwen-code',
  'roo-code',
  'trae',
  'warp',
  'windsurf',
  'zed',
] as const;
