/**
 * Codex rule markdown mirrors live under `.codex/instructions/`.
 * Native execution enforcement still projects to `.codex/rules/*.rules`.
 */

import type { CanonicalRule } from '../../core/types.js';
import { codexInstructionMirrorPath } from './instruction-mirror.js';

/**
 * Relative path for a markdown mirror of a canonical rule.
 */
export function codexAdvisoryInstructionPath(rule: CanonicalRule): string {
  return codexInstructionMirrorPath(rule);
}
