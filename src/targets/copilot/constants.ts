/**
 * Copilot target constants.
 * GitHub Copilot uses .github/copilot-instructions.md, .github/instructions/*.instructions.md,
 * .github/hooks/*.json, and .github/prompts/*.prompt.md.
 */

/** Global instructions file path */
export const COPILOT_INSTRUCTIONS = '.github/copilot-instructions.md';

/** Legacy per-context instructions directory */
export const COPILOT_CONTEXT_DIR = '.github/copilot';

/** Current instructions directory (GitHub Copilot CLI) */
export const COPILOT_INSTRUCTIONS_DIR = '.github/instructions';

/** Prompt files directory (manual reusable prompts / command-like tasks) */
export const COPILOT_PROMPTS_DIR = '.github/prompts';

/** Hooks directory for JSON hook configs and scripts */
export const COPILOT_HOOKS_DIR = '.github/hooks';

/** Agent skills directory (native). [gh:skills] */
export const COPILOT_SKILLS_DIR = '.github/skills';

/** Custom agent profiles directory (.agent.md files). [gh:agents] */
export const COPILOT_AGENTS_DIR = '.github/agents';
