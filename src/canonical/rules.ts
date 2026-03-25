/**
 * Parse .agentsbridge/rules/*.md into CanonicalRule objects.
 */

import { basename } from 'node:path';
import type { CanonicalRule } from '../core/types.js';
import { readFileSafe, readDirRecursive } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/markdown.js';

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
 * @param rulesDir - Absolute path to .agentsbridge/rules
 * @returns Array of parsed CanonicalRule, or [] if dir missing/empty
 */
export async function parseRules(rulesDir: string): Promise<CanonicalRule[]> {
  const files = await readDirRecursive(rulesDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const rules: CanonicalRule[] = [];
  for (const path of mdFiles) {
    const content = await readFileSafe(path);
    if (!content) continue;
    const { frontmatter, body } = parseFrontmatter(content);
    const name = basename(path, '.md');
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
