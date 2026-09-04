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
  'codebuff',
  'codex-cli',
  'continue',
  'copilot',
  'crush',
  'cursor',
  'deepagents-cli',
  'factory-droid',
  'gemini-cli',
  'goose',
  'junie',
  'kilo-code',
  'kimi-code',
  'kiro',
  'opencode',
  'openhands',
  'pi-agent',
  'qwen-code',
  'roo-code',
  'rovodev',
  'trae',
  'warp',
  'windsurf',
  'zed',
] as const;
