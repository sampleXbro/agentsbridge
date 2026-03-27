/**
 * Parse .agentsmesh/agents/*.md into CanonicalAgent objects.
 */

import { basename } from 'node:path';
import type { CanonicalAgent, Hooks } from '../../core/types.js';
import { readFileSafe, readDirRecursive } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';

/**
 * Coerce value to string array. Handles comma-separated string, YAML array, or invalid.
 * @param v - Raw value from YAML
 * @returns Normalized string array
 */
function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Coerce value to positive integer.
 * @param v - Raw value from YAML
 * @returns Number or 0 if invalid
 */
function toInt(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }
  return 0;
}

/**
 * Extract hooks object from frontmatter. Must be a plain object.
 * @param v - Raw value
 * @returns Record or empty object
 */
function toHooks(v: unknown): Hooks {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Hooks;
  }
  return {};
}

/**
 * Parse all agent files in an agents directory.
 * @param agentsDir - Absolute path to .agentsmesh/agents
 * @returns Array of parsed CanonicalAgent, or [] if dir missing/empty
 */
export async function parseAgents(agentsDir: string): Promise<CanonicalAgent[]> {
  const files = await readDirRecursive(agentsDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const agents: CanonicalAgent[] = [];
  for (const path of mdFiles) {
    const content = await readFileSafe(path);
    if (!content) continue;
    const { frontmatter, body } = parseFrontmatter(content);
    const name = basename(path, '.md');
    const toolsCamel = toStrArray(frontmatter.tools);
    const toolsKebab = toStrArray(frontmatter['tools']);
    const tools = toolsCamel.length > 0 ? toolsCamel : toolsKebab;
    const disallowedCamel = toStrArray(frontmatter.disallowedTools);
    const disallowedKebab = toStrArray(frontmatter['disallowed-tools']);
    const disallowedTools = disallowedCamel.length > 0 ? disallowedCamel : disallowedKebab;
    const mcpCamel = toStrArray(frontmatter.mcpServers);
    const mcpKebab = toStrArray(frontmatter['mcp-servers']);
    const mcpServers = mcpCamel.length > 0 ? mcpCamel : mcpKebab;
    const skills = toStrArray(frontmatter.skills);
    const maxTurnsCamel = toInt(frontmatter.maxTurns);
    const maxTurnsKebab = toInt(frontmatter['max-turns']);
    const maxTurns = maxTurnsCamel > 0 ? maxTurnsCamel : maxTurnsKebab > 0 ? maxTurnsKebab : 0;
    agents.push({
      source: path,
      name,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      tools,
      disallowedTools,
      model: typeof frontmatter.model === 'string' ? frontmatter.model : '',
      permissionMode:
        typeof frontmatter.permissionMode === 'string'
          ? frontmatter.permissionMode
          : typeof frontmatter['permission-mode'] === 'string'
            ? frontmatter['permission-mode']
            : '',
      maxTurns,
      mcpServers,
      hooks: toHooks(frontmatter.hooks),
      skills,
      memory: typeof frontmatter.memory === 'string' ? frontmatter.memory : '',
      body,
    });
  }
  return agents;
}
