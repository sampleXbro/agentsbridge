/**
 * Shared helper for the cross-target skill mirror pattern.
 *
 * Every target that stores skills in its own `skillsDir` mirrors them into
 * `.agents/skills/` so that the canonical reference chain and cross-tool skill
 * consumers always see a consistent location. The mirror is suppressed when a
 * target that writes to `.agents/skills/` natively is active, otherwise mirrors
 * collide with the native target's per-target rewritten content.
 */

/**
 * Target IDs whose project-scope `skillDir` is `.agents/skills`, meaning they
 * write skills there natively. Mirroring another target's skills into that
 * same path while one of these is active produces a content collision.
 *
 * This list is enforced to match `BUILTIN_TARGETS` by a unit test
 * (`tests/unit/targets/catalog/skill-mirror.test.ts`). It cannot be derived
 * here at module load because that would create an ESM cycle:
 * `skill-mirror -> builtin-targets -> <each target> -> skill-mirror`.
 *
 * To add a target: set `descriptor.project.skillDir = '.agents/skills'` AND
 * append its ID below. The drift test will fail if the two get out of sync.
 */
const NATIVE_AGENTS_SKILL_WRITERS: readonly string[] = [
  'amp',
  'antigravity',
  'codebuff',
  'codex-cli',
  'goose',
  'openhands',
  'replit-agent',
  'zed',
];

/**
 * Mirror a skill path from a target-specific dir to `.agents/skills/`.
 *
 * @param path - The generated output path to consider mirroring.
 * @param skillsDir - The target's skill directory prefix (e.g. `.cursor/skills`).
 * @param activeTargets - The list of active target IDs in the current run.
 * @returns The mirror path (`.agents/skills/{rest}`) or `null` if not applicable.
 */
export function mirrorSkillsToAgents(
  path: string,
  skillsDir: string,
  activeTargets: readonly string[],
): string | null {
  const hasNativeWriter = activeTargets.some((id) => NATIVE_AGENTS_SKILL_WRITERS.includes(id));
  if (path.startsWith(`${skillsDir}/`) && !hasNativeWriter) {
    return `.agents/skills/${path.slice(skillsDir.length + 1)}`;
  }
  return null;
}

/** Exposed for the drift test only. Do not consume in production code. */
export const _NATIVE_AGENTS_SKILL_WRITERS_FOR_TEST: readonly string[] = NATIVE_AGENTS_SKILL_WRITERS;
