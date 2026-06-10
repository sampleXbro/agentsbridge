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
 * scaffold runs (the legacy-form ladder below upgrades older wordings in place).
 */
export const LESSONS_PARAGRAPH_BLOCK = `${LESSONS_CONTRACT_START}
${LESSONS_PROCEDURAL_RULE}
${LESSONS_CONTRACT_END}`;

/**
 * Prior shipped wording — the full single-tier block, before the two-tier split
 * that moved the expansive how-to into the `lessons` skill and trimmed Tier 1.
 * Retained verbatim so a project generated with it strips/upgrades to the current
 * (trimmed) block exactly once on the next scaffold. Newest-first in
 * `LEGACY_RAW_FORMS`; mirrors the V1..Vn ladder in `root-instruction-paragraph.ts`.
 */
const LESSONS_RULE_V2 = `## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)

Two shell commands. Skipping either is a process violation; the user will check. The graph at \`.agentsmesh/lessons/lessons.json\` is canonical — NEVER edit by hand.

**Recall — MUST run BEFORE every file edit and every shell command. There is no read-only carve-out — the very first action of any turn that will touch a file or run a command is this query:**

1. Run: \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` for task matches).
2. Apply EVERY returned rule.
3. Then perform the edit / run the command.

Rejected excuses — each one means *query first*: *"the edit is small"*, *"I already know this"*, *"it's read-only / I'm just looking / just investigating"*, *"this command can't change anything"* (git, ls, cat, test runs, coverage **still count**), *"I'll do it later"*.

**Capture — MUST run IMMEDIATELY after ANY failure or mistake**, yours or anyone's. A failure is NOT limited to red test output — it includes a **user correction or pushback**, a failing test / CI / lint / typecheck, a code-review comment, a regression, a wrong assumption you made, work you had to redo, or behavior that surprised you:

1. Run: \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>\` (add \`--trigger-cmd <regex>\` / \`--trigger-kw <text>\` as needed).
2. Use \`agentsmesh lessons topics\` to find the topic id; pass \`--new-topic --topic-summary "<one line>"\` for a brand-new area.
3. The CLI writes \`lessons.json\` atomically — capture is one command.

Rejected excuses: *"it wasn't really a failure"* → it was. *"I'll capture it later"* → no. *"no topic fits"* → \`agentsmesh lessons topics\` then \`--new-topic\`.

No shell? Use the \`lessons_query\` and \`lessons_add\` MCP tools — same two operations. Run \`agentsmesh lessons --help\` for the full command set (\`show\`, \`deprecate\`, \`journal\`, \`validate\`, \`import-md\`).

**These two commands ARE the system. Skip them and the system does not exist.**`;

/**
 * Prior shipped wording of the procedural rule, before the read-only-excuse /
 * broadened-failure revision. Retained verbatim (newest-first in
 * `LEGACY_RAW_FORMS`) so a project generated with it strips/upgrades to the
 * current block exactly once on the next scaffold. Mirrors the V1..Vn ladder in
 * `root-instruction-paragraph.ts`.
 */
const LESSONS_RULE_V1 = `## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)

Two shell commands. Skipping either is a process violation; the user will check. The graph at \`.agentsmesh/lessons/lessons.json\` is canonical — NEVER edit by hand.

**Recall — MUST run BEFORE every file edit and every shell command:**

1. Run: \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` for task matches).
2. Apply EVERY returned rule.
3. Then perform the edit / run the command.

Rejected excuses: *"the edit is small"* → query it. *"I already know this"* → query it. *"I'll do it later"* → no.

**Capture — MUST run IMMEDIATELY after any failure** (test, CI, lint, code review, user correction, regression — anyone's mistake):

1. Run: \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>\` (add \`--trigger-cmd <regex>\` / \`--trigger-kw <text>\` as needed).
2. Use \`agentsmesh lessons topics\` to find the topic id; pass \`--new-topic --topic-summary "<one line>"\` for a brand-new area.
3. The CLI writes \`lessons.json\` atomically — capture is one command.

Rejected excuses: *"it wasn't really a failure"* → it was. *"I'll capture it later"* → no. *"no topic fits"* → \`agentsmesh lessons topics\` then \`--new-topic\`.

No shell? Use the \`lessons_query\` and \`lessons_add\` MCP tools — same two operations. Run \`agentsmesh lessons --help\` for the full command set (\`show\`, \`deprecate\`, \`journal\`, \`validate\`, \`import-md\`).

**These two commands ARE the system. Skip them and the system does not exist.**`;

/**
 * Prior shipped wording — the maximalist two-tier block (BLOCKING REQUIREMENT
 * header, "read-only included" recall scope, rebuttal pedagogy), before the
 * Phase-1 revision that scoped recall to mutating actions, exempted pure reads +
 * the recall query itself, and moved the pedagogy into the `lessons` skill.
 * Retained verbatim so a project generated with it strips/upgrades to the current
 * (scoped, compact) block exactly once on the next scaffold.
 */
const LESSONS_RULE_V3 = `## Lessons (BLOCKING REQUIREMENT — MUST run both, no exceptions; the user will check)

The graph \`.agentsmesh/lessons/lessons.json\` is canonical — never hand-edit. Full manual: the \`lessons\` skill.

**Recall — before every file edit and every shell command, read-only included (git/ls/cat/test runs still count):** run \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` to match by task), then apply every rule returned. Pass the real \`--file\`/\`--cmd\`: a predicate-less query is rejected, and keyword-only recall misses most lessons. Skipping recall is a process violation.

**Capture — immediately after any failure, not limited to red tests** (a failing CI/lint/typecheck, a code review, a user correction, a regression, or a wrong assumption — yours or anyone's): run \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\` — one trigger minimum (prefer \`--trigger-file\`); new area adds \`--new-topic --topic-summary "<line>"\`.

No shell? Use the \`lessons_query\` / \`lessons_add\` MCP tools. Skip these and the system does not exist.`;

/**
 * Legacy raw (sentinel-less) forms: the procedural paragraph as it was appended
 * directly into canonical `_root.md` before the managed-block model, newest
 * first. Stripped and upgraded so pre-existing projects converge on the block
 * exactly once.
 */
const LEGACY_RAW_FORMS = [LESSONS_PROCEDURAL_RULE, LESSONS_RULE_V3, LESSONS_RULE_V2, LESSONS_RULE_V1];

/**
 * Place the lessons ritual at the TOP of the document body, after any leading
 * frontmatter (so `_root.md`'s `---…---` stays first). Strips any prior block
 * or legacy raw form first, so an existing block appended at the end migrates to
 * the top on the next scaffold.
 */
export function appendLessonsParagraph(content: string): string {
  const withoutPrior = stripLessonsParagraph(content);
  return insertAtBodyTop(withoutPrior, LESSONS_PARAGRAPH_BLOCK);
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
