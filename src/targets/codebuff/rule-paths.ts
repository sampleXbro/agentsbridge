/**
 * Nested knowledge-file paths for scoped rules.
 *
 * Codebuff walks the project tree and loads ONE knowledge file per directory
 * (`selectKnowledgeFilePaths`, sdk/src/run-state.ts), with `AGENTS.md` beating
 * `CLAUDE.md`. That is the same directory-walk shape Codex CLI uses, so the
 * directory derivation is imported from `codex-rule-paths.ts` verbatim rather
 * than reimplemented: identical inputs must produce identical paths AND
 * identical bytes, or `resolveOutputCollisions` hard-fails when a user enables
 * both targets.
 *
 * Only the `AGENTS.md` member is emitted — Codebuff never reads a sibling
 * `CLAUDE.md` in a directory that already has `AGENTS.md`, and it has no
 * `AGENTS.override.md` concept at all.
 */

import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';
import { codexRuleDirectory } from '../codex-cli/codex-rule-paths.js';

/** Unscoped rules still nest under the rule slug here; Codex embeds them in the root instead. */
export function codebuffNestedKnowledgePath(rule: Pick<CanonicalRule, 'source' | 'globs'>): string {
  const dir = codexRuleDirectory(rule) ?? basename(rule.source, '.md');
  return `${dir}/AGENTS.md`;
}
