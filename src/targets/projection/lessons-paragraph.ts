import { LESSONS_PROCEDURAL_RULE } from '../../lessons/paths.js';
import {
  insertAtBodyTop,
  LESSONS_CONTRACT_END,
  LESSONS_CONTRACT_START,
  stripManagedBlock,
} from './managed-blocks.js';

/**
 * The lessons recall/capture ritual, wrapped in managed-block sentinels.
 *
 * Unlike the generation contract, this block IS canonical content: `init
 * --lessons` writes it into `.agentsmesh/rules/_root.md` (see `scaffoldLessons`),
 * so it reaches every target through ordinary canonical rule generation — even
 * rules-directory targets the generation-contract decorator skips. The sentinels
 * keep the block an identifiable unit so round-trip is byte-stable and wording
 * updates propagate from the `LESSONS_PROCEDURAL_RULE` constant the next time
 * scaffold runs.
 */
export const LESSONS_PARAGRAPH_BLOCK = `${LESSONS_CONTRACT_START}
${LESSONS_PROCEDURAL_RULE}
${LESSONS_CONTRACT_END}`;

/**
 * Place the lessons ritual at the TOP of the document body, after any leading
 * frontmatter (so `_root.md`'s `---…---` stays first). Strips any prior block
 * first, so an existing block appended at the end migrates to the top on the
 * next scaffold.
 */
export function appendLessonsParagraph(content: string): string {
  const withoutPrior = stripLessonsParagraph(content);
  return insertAtBodyTop(withoutPrior, LESSONS_PARAGRAPH_BLOCK);
}

export function stripLessonsParagraph(content: string): string {
  const withoutBlock = stripManagedBlock(content, LESSONS_CONTRACT_START, LESSONS_CONTRACT_END);
  return stripRawProceduralRule(withoutBlock).trim();
}

/**
 * Defensive strip of a SENTINEL-LESS copy of the current procedural rule, so a
 * hand-pasted or merge-mangled raw paragraph de-duplicates on the next scaffold
 * instead of leaving a second copy beside the managed block. The lessons feature
 * is unreleased, so there is no prior-wording migration ladder to carry — only
 * the current wording is recognised.
 */
function stripRawProceduralRule(content: string): string {
  return content
    .replace(`\n\n${LESSONS_PROCEDURAL_RULE}`, '')
    .replace(LESSONS_PROCEDURAL_RULE, '');
}
