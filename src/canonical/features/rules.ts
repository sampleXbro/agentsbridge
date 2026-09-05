/**
 * Parse .agentsmesh/rules/*.md into CanonicalRule objects.
 */

import { isEmptyCanonicalFile } from './empty-file.js';
import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';
import { readFileSafe, readDirRecursiveNoSymlinks } from '../../utils/filesystem/fs.js';
import { parseOrSkipFrontmatter } from '../../utils/text/markdown.js';
import { assertCanonicalName, assertNoBasenameCollisions } from './validate-name.js';
import {
  warnIfUnrecognizedResourceFormats,
  type UnrecognizedFormatsWarningOptions,
} from './unrecognized-files-warning.js';

export interface ParseFrontmatterOptions extends UnrecognizedFormatsWarningOptions {
  /**
   * When supplied, frontmatter parse failures invoke the callback and the
   * offending file is skipped instead of aborting the whole parse. Used by
   * the install path to keep the run going through third-party content with
   * malformed YAML. Strict callers (`generate`/`lint`/`check`) leave it unset.
   */
  onParseError?: (err: Error, filePath: string) => void;
}

const VALID_TRIGGERS = ['always_on', 'model_decision', 'glob', 'manual'] as const;
type Trigger = (typeof VALID_TRIGGERS)[number];

/**
 * Coerce value to string array. Handles string, string[], or invalid.
 * @param v - Raw value from YAML
 * @returns Normalized string array
 */
function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') return v ? [v] : [];
  return [];
}

/**
 * Parse all rule files in a rules directory.
 * @param rulesDir - Absolute path to .agentsmesh/rules
 * @returns Array of parsed CanonicalRule, or [] if dir missing/empty
 */
export async function parseRules(
  rulesDir: string,
  opts: ParseFrontmatterOptions = {},
): Promise<CanonicalRule[]> {
  // No-symlinks: a symlinked rule file could point at a host secret and would
  // otherwise be read into canonical and copied into a redistributed pack.
  const files = await readDirRecursiveNoSymlinks(rulesDir);
  const mdFiles = files.filter((f) => {
    if (!f.endsWith('.md')) return false;
    const name = basename(f, '.md');
    return name === '_root' || !name.startsWith('_');
  });
  warnIfUnrecognizedResourceFormats('rules', rulesDir, files, mdFiles, {
    handledByOtherReader: opts.handledByOtherReader,
  });
  // Two rules with the same slug (e.g. rules/foo.md + rules/sub/foo.md, or a
  // duplicate _root.md) collapse in the generate loop — the second silently
  // splices out the first before any output-collision check. Fail at parse time.
  assertNoBasenameCollisions('rule', mdFiles, '.md');
  const rules: CanonicalRule[] = [];
  for (const path of mdFiles) {
    const content = await readFileSafe(path);
    if (content === null) continue;
    if (isEmptyCanonicalFile(content, path)) continue;
    const parsed = parseOrSkipFrontmatter(content, path, opts.onParseError);
    if (!parsed) continue;
    const { frontmatter, body } = parsed;
    const name = basename(path, '.md');
    assertCanonicalName('rule', name);
    const rootFromFilename = name === '_root';
    const rootFromFm = frontmatter.root === true;
    const triggerRaw = frontmatter.trigger;
    const trigger: Trigger | undefined =
      typeof triggerRaw === 'string' && VALID_TRIGGERS.includes(triggerRaw as Trigger)
        ? (triggerRaw as Trigger)
        : undefined;
    const codexEmitRaw = frontmatter.codex_emit;
    const codexEmit =
      codexEmitRaw === 'execution'
        ? ('execution' as const)
        : codexEmitRaw === 'advisory'
          ? ('advisory' as const)
          : undefined;
    const instrRaw = frontmatter.codex_instruction;
    const codexInstructionVariant = instrRaw === 'override' ? ('override' as const) : undefined;
    rules.push({
      source: path,
      root: rootFromFilename || rootFromFm,
      targets: toStrArray(frontmatter.targets),
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      globs: toStrArray(frontmatter.globs),
      body,
      ...(trigger !== undefined && { trigger }),
      ...(codexEmit !== undefined && { codexEmit }),
      ...(codexInstructionVariant !== undefined && { codexInstructionVariant }),
    });
  }
  return rules;
}
