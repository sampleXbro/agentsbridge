/**
 * Claude Code global-scope extras: output-styles generation.
 * Implements `globalSupport.scopeExtras` for Claude Code.
 */

import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { CLAUDE_OUTPUT_STYLES_DIR } from './constants.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Emit ~/.claude/output-styles/{name}.md for agents/commands marked outputStyle in frontmatter.
 * No-ops outside of global scope.
 */
export async function generateClaudeGlobalExtras(
  canonical: CanonicalFiles,
  projectRoot: string,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): Promise<GenerateResult[]> {
  if (scope !== 'global') return [];

  const hasAgents = enabledFeatures.has('agents');
  const hasCommands = enabledFeatures.has('commands');
  if (!hasAgents && !hasCommands) return [];

  const results: GenerateResult[] = [];

  if (hasAgents) {
    for (const agent of canonical.agents) {
      if (!agent.outputStyle) continue;
      const fm = { name: agent.name, description: agent.description || undefined };
      const content = serializeFrontmatter(fm, agent.body.trim());
      const path = `${CLAUDE_OUTPUT_STYLES_DIR}/${agent.name}.md`;
      const existing = await readFileSafe(join(projectRoot, path));
      results.push({
        target: 'claude-code',
        path,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
      });
    }
  }

  if (hasCommands) {
    for (const cmd of canonical.commands) {
      if (!cmd.outputStyle) continue;
      const fm = { name: cmd.name, description: cmd.description || undefined };
      const content = serializeFrontmatter(fm, cmd.body.trim());
      const path = `${CLAUDE_OUTPUT_STYLES_DIR}/${cmd.name}.md`;
      const existing = await readFileSafe(join(projectRoot, path));
      results.push({
        target: 'claude-code',
        path,
        content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, content),
      });
    }
  }

  return results;
}
