import { LESSONS_PROCEDURAL_RULE } from '../../lessons/paths.js';
import {
  insertAtBodyTop,
  LESSONS_CONTRACT_END,
  LESSONS_CONTRACT_START,
  stripManagedBlock,
} from './managed-blocks.js';

const LEGACY_RAW_FORMS = [
  // Pre-`--session auto` wording (2026-07): strip sentinel-less copies so a
  // project scaffolded before the dedup correlator dedups on the next scaffold.
  `## Lessons (BLOCKING)

Graph \`.agentsmesh/lessons/lessons.json\` is canonical; never hand-edit it. Manual: \`lessons\` skill.

**Recall:** before every file edit or state-changing command, MUST run \`agentsmesh lessons query --file <path> --cmd <command>\` and obey matches; at task start, ALSO run \`agentsmesh lessons query --keyword "<task terms>" --always\` for conceptual + universal rules no path/command names. Pure-read commands and recall itself are exempt.

**Capture:** after any failure, user correction, regression, wrong assumption, useful surprise, repeated friction, or non-obvious fix, MUST self-critique and run \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\`.

**Before final:** report \`Lesson: captured <id>\` or \`Lesson: none\`. No recall/capture gate = task incomplete. No shell: use \`lessons_query\` / \`lessons_add\`.`,
  `## Lessons (BLOCKING REQUIREMENT — MUST run both, no exceptions; the user will check)

Graph \`.agentsmesh/lessons/lessons.json\` is canonical — never hand-edit. Manual: the \`lessons\` skill.

**Recall — MUST run before every file edit and every state-changing command** (build/test/install/migrate/git-write): \`agentsmesh lessons query --file <path> --cmd <command>\`, then apply every rule. Pure-read commands (cat/ls/grep/git-log) and the recall query itself are exempt.

**Capture — MUST run immediately after any failure** (a failing test/CI/lint/typecheck, a code review, a user correction, a regression, or a wrong assumption — yours or anyone's): \`agentsmesh lessons add "<rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\`.

No shell? Use the \`lessons_query\` / \`lessons_add\` MCP tools. Skip either and the system does not exist.`,
];

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
 * Defensive strip of a SENTINEL-LESS copy of a procedural rule, so a hand-pasted
 * or merge-mangled raw paragraph de-duplicates on the next scaffold instead of
 * leaving a second copy beside the managed block.
 */
function stripRawProceduralRule(content: string): string {
  return [LESSONS_PROCEDURAL_RULE, ...LEGACY_RAW_FORMS].reduce(
    (next, rule) => next.replace(`\n\n${rule}`, '').replace(rule, ''),
    content,
  );
}
