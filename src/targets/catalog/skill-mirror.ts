/**
 * Shared helper for the cross-target skill mirror pattern.
 *
 * Every target that stores skills in its own `skillsDir` mirrors them into
 * `.agents/skills/` so that the canonical reference chain and cross-tool skill
 * consumers always see a consistent location.  The mirror is suppressed when
 * codex-cli is active because codex-cli owns `.agents/skills/` natively and
 * would create conflicts.
 */

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
  if (path.startsWith(`${skillsDir}/`) && !activeTargets.includes('codex-cli')) {
    return `.agents/skills/${path.slice(skillsDir.length + 1)}`;
  }
  return null;
}
