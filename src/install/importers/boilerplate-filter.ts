/**
 * Filename filter for repository boilerplate markdown files
 * (README/LICENSE/CONTRIBUTING/etc.) used by the install-time entity
 * importers when discovering content from third-party source repos.
 *
 * Scope: install discovery only. The canonical parsers
 * (`parseAgents`/`parseCommands`/`parseRules`) intentionally do NOT use this
 * filter — a user is allowed to name their own canonical content
 * `security.md` or `support.md` and expect it to be loaded. The filter
 * exists specifically to drop housekeeping files that accompany code in
 * third-party repos (`agents/README.md`, `commands/CONTRIBUTING.md`).
 *
 * Matching is case-insensitive and extension-agnostic: the last `.<ext>`
 * suffix is stripped and the remaining stem is compared against a fixed
 * vocabulary. Files whose stem merely begins with a boilerplate prefix
 * (e.g. `readme-extension.md`) are NOT matched. Non-markdown noise
 * (`.gitignore`, `package.json`, `.DS_Store`) is handled upstream by
 * extension/glob checks and is intentionally outside this helper's scope.
 */

const BOILERPLATE_STEMS: ReadonlySet<string> = new Set([
  'readme',
  'license',
  'license-mit',
  'license-apache',
  'license-bsd',
  'license-gpl',
  'contributing',
  'changelog',
  'changes',
  'history',
  'code_of_conduct',
  'security',
  'support',
  'maintainers',
  'governance',
  'authors',
  'contributors',
  'codeowners',
  'notice',
  'citation',
  'acknowledgments',
  'acknowledgements',
]);

/**
 * Returns true when `filename` is repository boilerplate that should be
 * excluded from canonical entity discovery (agents/commands/rules).
 *
 * Matching is case-insensitive and extension-agnostic: the last `.<ext>`
 * suffix is stripped and the remaining stem is compared against a fixed
 * vocabulary. Files whose stem merely begins with a boilerplate prefix
 * (e.g. `readme-extension.md`) are NOT matched.
 */
export function isBoilerplate(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const stem = dotIdx > 0 ? lower.slice(0, dotIdx) : lower;
  return BOILERPLATE_STEMS.has(stem);
}
