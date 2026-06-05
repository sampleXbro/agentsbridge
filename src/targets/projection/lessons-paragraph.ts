import { LESSONS_PROCEDURAL_RULE } from '../../lessons/paths.js';
import {
  LESSONS_CONTRACT_END,
  LESSONS_CONTRACT_START,
  replaceManagedBlock,
  stripManagedBlock,
} from './managed-blocks.js';

/**
 * The lessons recall/capture ritual, wrapped in managed-block sentinels.
 *
 * Like the root generation contract, the lessons paragraph is NOT canonical
 * content. It is injected into a target's primary root instruction at generate
 * time (only when the lessons subsystem is active) and stripped on import.
 * Sentinels make the block an identifiable unit so round-trip is byte-stable
 * and wording updates propagate from the `LESSONS_PROCEDURAL_RULE` constant on
 * the next `generate` rather than drifting in canonical `_root.md`.
 */
export const LESSONS_PARAGRAPH_BLOCK = `${LESSONS_CONTRACT_START}
${LESSONS_PROCEDURAL_RULE}
${LESSONS_CONTRACT_END}`;

/**
 * Legacy raw (sentinel-less) form: the procedural paragraph as it was appended
 * directly into canonical `_root.md` before the managed-block model. Stripped
 * and upgraded so pre-existing projects converge on the block exactly once.
 */
const LEGACY_RAW_FORMS = [LESSONS_PROCEDURAL_RULE];

export function appendLessonsParagraph(content: string): string {
  const withoutLegacy = stripLegacyRawForms(content).trim();
  return replaceManagedBlock(
    withoutLegacy,
    LESSONS_CONTRACT_START,
    LESSONS_CONTRACT_END,
    LESSONS_PARAGRAPH_BLOCK,
  );
}

export function stripLessonsParagraph(content: string): string {
  const withoutBlock = stripManagedBlock(content, LESSONS_CONTRACT_START, LESSONS_CONTRACT_END);
  return stripLegacyRawForms(withoutBlock).trim();
}

function stripLegacyRawForms(content: string): string {
  let result = content;
  for (const legacy of LEGACY_RAW_FORMS) {
    result = result.replace(`\n\n${legacy}`, '').replace(legacy, '');
  }
  return result;
}
