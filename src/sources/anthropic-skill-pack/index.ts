/**
 * Anthropic skill-pack source descriptor.
 *
 * Declares how `aggregateAnthropicSkillPack` should discover content in a
 * fetched skill-pack repo: which command directories to merge and the
 * precedence rule on collision. The explicit root `commands/` directory wins
 * over both per-tool directories (`.claude/commands/`, `.gemini/commands/`),
 * and `.claude` wins over `.gemini` on a same-name conflict (C1 contract).
 *
 * The skill-pack descriptor is the only entry point for the install pipeline;
 * the aggregator type and orchestration live in `aggregate.ts`.
 */

import type { SourceDescriptor } from './aggregate.js';

export const anthropicSkillPackSource: SourceDescriptor = {
  id: 'anthropic-skill-pack',
  mergeFromToolDirs: [
    { dir: 'commands', precedence: 0 },
    { dir: '.claude/commands', target: 'claude-code', precedence: 1 },
    { dir: '.gemini/commands', target: 'gemini-cli', precedence: 2 },
  ],
};
