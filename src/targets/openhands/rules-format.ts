/**
 * Canonical rule <-> OpenHands rule file.
 *
 * A markdown file directly under `.agents/skills/` is a rule, not a skill
 * bundle. With a `paths:` frontmatter key (YAML list or comma-separated string)
 * it is injected only for matching files; without one it is always injected.
 * `paths` is the required key of the path-scoped form, so it is the only key
 * agentsmesh derives — `description` rides along because the sibling SKILL.md
 * frontmatter model already carries it and it keeps the round-trip lossless.
 */

import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import { toStringArray } from '../import/import-metadata.js';

export function openhandsRuleSlug(rule: CanonicalRule): string {
  return basename(rule.source, '.md');
}

export function serializeOpenhandsRule(rule: CanonicalRule): string {
  const frontmatter: Record<string, unknown> = {};
  if (rule.description) frontmatter.description = rule.description;
  if (rule.globs.length > 0) frontmatter.paths = rule.globs;
  return serializeFrontmatter(frontmatter, rule.body.trim());
}

/** Rewrite an imported rule's frontmatter: `paths` becomes canonical `globs`. */
export function remapOpenhandsRuleFrontmatter(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const { paths, ...rest } = frontmatter;
  const globs = toStringArray(paths);
  return globs.length > 0 ? { ...rest, globs } : rest;
}
