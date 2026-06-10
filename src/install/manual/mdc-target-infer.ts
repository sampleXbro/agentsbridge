/**
 * Infer the target tool from .mdc frontmatter shape.
 *
 * Each target declares its identifying frontmatter key(s) via
 * `descriptor.nativeInstall.dialectHints` (e.g. Cursor → `alwaysApply`,
 * Windsurf → `trigger`). A directory resolves to a target only when exactly
 * one target's hints match; ambiguous (both/neither) returns null and the
 * caller must pass --target. This module carries no target-id literals.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getAllRegisteredDescriptorIds, getDescriptor } from '../../targets/catalog/registry.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { tryParseFrontmatter } from '../../utils/text/markdown.js';

function targetsMatchingFrontmatter(frontmatter: Record<string, unknown>): string[] {
  const matches: string[] = [];
  for (const id of getAllRegisteredDescriptorIds()) {
    const hints = getDescriptor(id)?.nativeInstall?.dialectHints;
    if (!hints?.length) continue;
    if (hints.some((hint) => hint.frontmatterKey in frontmatter)) matches.push(id);
  }
  return matches;
}

export async function inferMdcTarget(dirPath: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return null;
  }
  const mdcFile = entries.sort().find((e) => e.toLowerCase().endsWith('.mdc'));
  if (!mdcFile) return null;

  const content = await readFileSafe(join(dirPath, mdcFile));
  if (!content) return null;

  const parsed = tryParseFrontmatter(content, join(dirPath, mdcFile));
  if (!parsed.ok) return null;

  const matches = targetsMatchingFrontmatter(parsed.value.frontmatter);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
