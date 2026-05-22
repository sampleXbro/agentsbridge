/**
 * Shared .mdc reader that normalizes cursor/windsurf frontmatter to canonical form.
 *
 * Used by both the install manual-scope path and the cursor/windsurf importers
 * to keep .mdc parsing in one place.
 */

import { tryParseFrontmatter, serializeFrontmatter } from '../../utils/text/markdown.js';

function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') return v ? [v] : [];
  return [];
}

function normalizeCursorKeys(fm: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fm };
  const isRoot = fm.alwaysApply === true;
  out.root = isRoot;
  delete out.alwaysApply;

  if (!isRoot) {
    const globs = toStrArray(fm.globs);
    const description = typeof fm.description === 'string' ? fm.description.trim() : '';
    if (globs.length > 0) {
      out.trigger = 'glob';
    } else if (description.length > 0) {
      out.trigger = 'model_decision';
    } else {
      out.trigger = 'manual';
    }
  }
  return out;
}

function normalizeWindsurfKeys(fm: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fm };

  if (out.trigger === 'always') {
    out.trigger = 'always_on';
  }

  if (typeof out.glob === 'string') {
    out.globs = toStrArray(out.globs).length > 0 ? toStrArray(out.globs) : [out.glob as string];
    delete out.glob;
  }

  return out;
}

export function normalizeMdcToCanonical(content: string): string {
  const parsed = tryParseFrontmatter(content, '<mdc>');
  if (!parsed.ok) return parsed.bodyFallback;
  const { frontmatter, body } = parsed.value;
  if (Object.keys(frontmatter).length === 0 && !content.startsWith('---')) return content;

  let normalized: Record<string, unknown>;
  if ('alwaysApply' in frontmatter) {
    normalized = normalizeCursorKeys(frontmatter);
  } else if ('trigger' in frontmatter || 'glob' in frontmatter) {
    normalized = normalizeWindsurfKeys(frontmatter);
  } else {
    normalized = frontmatter;
  }

  return serializeFrontmatter(normalized, body.trim());
}
