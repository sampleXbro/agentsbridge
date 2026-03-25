/**
 * Parse .agentsbridge/commands/*.md into CanonicalCommand objects.
 */

import { basename } from 'node:path';
import type { CanonicalCommand } from '../core/types.js';
import { readFileSafe, readDirRecursive } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/markdown.js';

/**
 * Coerce value to tools array. Handles comma-separated string, string[], or invalid.
 * @param v - Raw value from YAML (e.g. "Read, Grep" or ["Read", "Grep"])
 * @returns Normalized string array
 */
function toToolsArray(v: unknown): string[] {
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
 * Parse all command files in a commands directory.
 * @param commandsDir - Absolute path to .agentsbridge/commands
 * @returns Array of parsed CanonicalCommand, or [] if dir missing/empty
 */
export async function parseCommands(commandsDir: string): Promise<CanonicalCommand[]> {
  const files = await readDirRecursive(commandsDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const commands: CanonicalCommand[] = [];
  for (const path of mdFiles) {
    const content = await readFileSafe(path);
    if (!content) continue;
    const { frontmatter, body } = parseFrontmatter(content);
    const name = basename(path, '.md');
    const fromCamel = toToolsArray(frontmatter.allowedTools);
    const fromKebab = toToolsArray(frontmatter['allowed-tools']);
    const allowedTools = fromCamel.length > 0 ? fromCamel : fromKebab;
    commands.push({
      source: path,
      name,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      allowedTools,
      body,
    });
  }
  return commands;
}
