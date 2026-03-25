/**
 * Detection helpers for agentsbridge init command.
 */

import { join } from 'node:path';
import { exists } from '../../utils/fs.js';

/** AI tool indicators for detection. */
export const TOOL_INDICATORS: Array<{ id: string; paths: string[] }> = [
  { id: 'claude-code', paths: ['CLAUDE.md', '.claude/rules', '.claude/commands'] },
  { id: 'cursor', paths: ['.cursor/rules', '.cursor/mcp.json'] },
  {
    id: 'copilot',
    paths: [
      '.github/copilot-instructions.md',
      '.github/copilot',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
      '.github/agents',
      '.github/hooks',
    ],
  },
  { id: 'continue', paths: ['.continue/rules', '.continue/skills', '.continue/mcpServers'] },
  {
    id: 'junie',
    paths: [
      '.junie/guidelines.md',
      '.junie/AGENTS.md',
      '.junie/skills',
      '.junie/mcp/mcp.json',
      '.aiignore',
    ],
  },
  { id: 'gemini-cli', paths: ['GEMINI.md', '.gemini'] },
  { id: 'cline', paths: ['.clinerules', '.cline'] },
  { id: 'codex-cli', paths: ['codex.md'] },
  { id: 'windsurf', paths: ['.windsurfrules', '.windsurf'] },
];

/**
 * Detect existing AI tool configs in the project.
 * @param projectRoot - Project root directory
 * @returns Array of tool IDs that have configs
 */
export async function detectExistingConfigs(projectRoot: string): Promise<string[]> {
  const found: string[] = [];
  for (const { id, paths } of TOOL_INDICATORS) {
    for (const p of paths) {
      const full = join(projectRoot, p);
      if (await exists(full)) {
        found.push(id);
        break;
      }
    }
  }
  return [...new Set(found)];
}
