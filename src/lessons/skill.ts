import { serializeFrontmatter } from '../utils/text/markdown.js';

/**
 * Tier 2 of the lessons contract: the on-demand operating manual.
 *
 * The always-on trigger lives in the root instruction (`LESSONS_PROCEDURAL_RULE`,
 * injected into `.agentsmesh/rules/_root.md`). That block is deliberately minimal
 * — it carries only the binding essentials. This skill holds the expansive how-to
 * (full command set, topic workflow, trigger-flag mechanics, the complete
 * rejected-excuses enumeration, the MCP fallback) so the manual can grow without
 * bloating every target's always-on context.
 *
 * Borrowed from the superpowers pattern (minimal always-on bootstrap + a
 * progressive-disclosure skill manual), but realized with agentsmesh's NATIVE
 * primitives: the trigger rides canonical rules (native on every target) and the
 * manual rides a canonical skill (native on every skill-supporting target),
 * rather than a SessionStart hook (not a canonical event; unsupported on most
 * targets). A target without skills still gets the trigger — graceful fallback.
 */
export const LESSONS_SKILL_NAME = 'lessons';

export const LESSONS_SKILL_DESCRIPTION =
  'Full operating manual for the agentsmesh lessons system (recall + capture). ' +
  'Consult when running any `agentsmesh lessons` subcommand (query, add, topics, ' +
  'show, deprecate, journal, validate, import-md), choosing a topic or trigger ' +
  'flags, using the lessons MCP tools, or when unsure how to phrase or capture a lesson.';

export const LESSONS_SKILL_BODY = `# Lessons — full operating manual

The lessons system is two shell commands: **Recall** (before you act) and **Capture**
(after any failure). The always-on rule in the root instructions is the trigger; this
skill is the complete reference. The graph at \`.agentsmesh/lessons/lessons.json\` is
canonical — NEVER edit it by hand.

## Recall — before every file edit and every shell command

There is no read-only carve-out. The very first action of any turn that will touch a
file or run a command is to run \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\`
(add \`--keyword <text>\` to match by task). Apply EVERY returned rule, then act.

**Rejected excuses — each one means *query first*:** *"the edit is small"*, *"I already
know this"*, *"it's read-only / I'm just looking / just investigating"*, *"this command
can't change anything"* (git, ls, cat, test runs, coverage **still count**), *"I'll do
it later"*.

## Capture — immediately after any failure or mistake

A failure is NOT limited to red test output. It includes a user correction or pushback,
a failing test / CI / lint / typecheck, a code-review comment, a regression, a wrong
assumption you made, work you had to redo, or behavior that surprised you.

Run \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>\`.

- Add \`--trigger-cmd <regex>\` and/or \`--trigger-kw <text>\` to widen when the lesson fires.
- Find the topic id with \`agentsmesh lessons topics\`.
- Brand-new area? Pass \`--new-topic --topic-summary "<one line>"\`.

**Rejected excuses:** *"it wasn't really a failure"* → it was. *"I'll capture it later"*
→ no. *"no topic fits"* → \`agentsmesh lessons topics\` then \`--new-topic\`.

## No shell?

Use the \`lessons_query\` and \`lessons_add\` MCP tools — the same two operations.

## Full command set

Run \`agentsmesh lessons --help\` for everything. Beyond \`query\` and \`add\`:

- \`agentsmesh lessons topics\` — list topic ids + summaries.
- \`agentsmesh lessons show <id>\` — inspect a single lesson.
- \`agentsmesh lessons deprecate <id>\` — retire a lesson that no longer holds.
- \`agentsmesh lessons journal\` — review recent capture/recall activity.
- \`agentsmesh lessons validate\` — check the graph for integrity problems.
- \`agentsmesh lessons import-md <file>\` — bulk-import lessons from Markdown.
- \`agentsmesh lessons stats\` — recall-effectiveness telemetry (opt-in).

## Why this matters

These two commands ARE the system. Skip them and the system does not exist.`;

/** Serialized canonical \`SKILL.md\` content for the lessons manual. */
export const LESSONS_SKILL_FILE = serializeFrontmatter(
  { name: LESSONS_SKILL_NAME, description: LESSONS_SKILL_DESCRIPTION },
  LESSONS_SKILL_BODY,
);
