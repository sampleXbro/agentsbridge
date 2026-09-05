/**
 * Parse .agentsmesh/commands/*.md into CanonicalCommand objects.
 */

import { isEmptyCanonicalFile } from './empty-file.js';
import { basename } from 'node:path';
import type { CanonicalCommand } from '../../core/types.js';
import { readFileSafe, readDirRecursiveNoSymlinks } from '../../utils/filesystem/fs.js';
import { parseOrSkipFrontmatter } from '../../utils/text/markdown.js';
import type { ParseFrontmatterOptions } from './rules.js';
import { assertCanonicalName, assertNoBasenameCollisions } from './validate-name.js';
import {
  warnIfUnrecognizedResourceFormats,
  type UnrecognizedFormatsWarningOptions,
} from './unrecognized-files-warning.js';

/**
 * Coerce value to tools array. Handles comma-separated string, string[], or invalid.
 * @param v - Raw value from YAML (e.g. "Read, Grep" or ["Read", "Grep"])
 * @returns Normalized string array
 */
function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

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

export interface ParseCommandsOptions
  extends ParseFrontmatterOptions, UnrecognizedFormatsWarningOptions {}

/**
 * Parse all command files in a commands directory.
 * @param commandsDir - Absolute path to .agentsmesh/commands
 * @returns Array of parsed CanonicalCommand, or [] if dir missing/empty
 */
export async function parseCommands(
  commandsDir: string,
  opts: ParseCommandsOptions = {},
): Promise<CanonicalCommand[]> {
  // No-symlinks: see parseRules — host-secret exfiltration guard.
  const files = await readDirRecursiveNoSymlinks(commandsDir);
  const mdFiles = files.filter((f) => f.endsWith('.md') && !basename(f).startsWith('_'));
  warnIfUnrecognizedResourceFormats('commands', commandsDir, files, mdFiles, {
    handledByOtherReader: opts.handledByOtherReader,
  });
  assertNoBasenameCollisions('command', mdFiles, '.md');
  const commands: CanonicalCommand[] = [];
  for (const path of mdFiles) {
    const content = await readFileSafe(path);
    if (content === null) continue;
    if (isEmptyCanonicalFile(content, path)) continue;
    const parsed = parseOrSkipFrontmatter(content, path, opts.onParseError);
    if (!parsed) continue;
    const { frontmatter, body } = parsed;
    const name = basename(path, '.md');
    assertCanonicalName('command', name);
    const fromCamel = toToolsArray(frontmatter.allowedTools);
    const fromKebab = toToolsArray(frontmatter['allowed-tools']);
    const allowedTools = fromCamel.length > 0 ? fromCamel : fromKebab;
    commands.push({
      source: path,
      name,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      allowedTools,
      outputStyle: toBool(frontmatter.outputStyle) || toBool(frontmatter['output-style']),
      body,
    });
  }
  return commands;
}
