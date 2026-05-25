/**
 * Filename filters for repository housekeeping artifacts.
 *
 * Single source of truth for files that should never become canonical
 * entities (rules / commands / agents). Boilerplate is split into two
 * categories by `BoilerplateKind`:
 *
 *   - `'noise'`     — CONTRIBUTING, CHANGELOG, CODE_OF_CONDUCT, SECURITY,
 *                     AUTHORS, MAINTAINERS, etc. Dropped everywhere on the
 *                     install path: never an entity, never packaged into a
 *                     skill's supporting files. Their content and links are
 *                     upstream-repo specific and add no value downstream.
 *   - `'preserved'` — LICENSE / NOTICE / COPYING / COPYRIGHT and README.
 *                     Never an entity, but kept as passive supporting files
 *                     inside skill subtrees. LICENSE/NOTICE/COPYING/COPYRIGHT
 *                     must travel with redistributed content per
 *                     MIT/Apache/BSD/GPL terms; README provides skill-specific
 *                     context (overview, usage, prerequisites) that explains
 *                     the skill to the downstream consumer.
 *
 * Public predicates, all case-insensitive and extension-agnostic:
 *
 *   - `isBoilerplate(filename)`           — true for ALL boilerplate (entity discovery filter)
 *   - `isPreservedBoilerplate(filename)`  — true only for preserved
 *   - `isNoiseBoilerplate(filename)`      — true only for noise (skill supporting-files filter)
 *
 * The matching key is the file's lowercased stem (last `.ext` stripped).
 * Files whose stem merely begins with a boilerplate prefix (e.g.
 * `readme-extension.md`) are NOT matched.
 *
 * Scope: install discovery / staging only. The canonical parsers
 * (`parseAgents`/`parseCommands`/`parseRules`) intentionally remain
 * filter-free for the user's own `.agentsmesh/` so users may legitimately
 * name canonical content `security.md` / `support.md`.
 */

type BoilerplateKind = 'noise' | 'preserved';

/**
 * Single source of truth for boilerplate stem → category. All public
 * predicates derive from this map; add a new boilerplate file by adding
 * one entry here.
 */
const BOILERPLATE_STEMS: ReadonlyMap<string, BoilerplateKind> = new Map([
  // Noise — upstream-repo housekeeping with no downstream value.
  ['contributing', 'noise'],
  ['changelog', 'noise'],
  ['changes', 'noise'],
  ['history', 'noise'],
  ['code_of_conduct', 'noise'],
  ['security', 'noise'],
  ['support', 'noise'],
  ['maintainers', 'noise'],
  ['governance', 'noise'],
  ['authors', 'noise'],
  ['contributors', 'noise'],
  ['codeowners', 'noise'],
  ['citation', 'noise'],
  ['acknowledgments', 'noise'],
  ['acknowledgements', 'noise'],
  // Preserved — installed alongside content but never treated as an entity.
  // LICENSE family: legal attribution required by MIT/Apache/BSD/GPL.
  ['license', 'preserved'],
  ['license-mit', 'preserved'],
  ['license-apache', 'preserved'],
  ['license-bsd', 'preserved'],
  ['license-gpl', 'preserved'],
  ['notice', 'preserved'],
  ['copying', 'preserved'],
  ['copyright', 'preserved'],
  // README: skill-specific context (overview, usage, prerequisites) that
  // explains the skill to the downstream consumer. Filtered from entity
  // discovery so it can never become a phantom rule/command/agent named
  // "README", but kept as a supporting file so the docs travel with the install.
  ['readme', 'preserved'],
]);

/** VCS / tooling / editor state directories that are never agent content. */
const NON_CONTENT_DIRS: ReadonlySet<string> = new Set([
  '.git',
  '.github',
  '.gitlab',
  'node_modules',
  '.vscode',
  '.idea',
]);

/** Exact non-markdown filenames that are never agent content. */
const NON_CONTENT_FILES: ReadonlySet<string> = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.DS_Store',
]);

function boilerplateKind(filename: string): BoilerplateKind | undefined {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const stem = dotIdx > 0 ? lower.slice(0, dotIdx) : lower;
  return BOILERPLATE_STEMS.get(stem);
}

/**
 * Returns true when `filename` is repository boilerplate that should be
 * excluded from canonical entity discovery (agents / commands / rules) and
 * from flat-collection classification. Includes both noise and preserved.
 */
export function isBoilerplate(filename: string): boolean {
  return boilerplateKind(filename) !== undefined;
}

/**
 * Returns true when `filename` is a preserved boilerplate file
 * (LICENSE / NOTICE / COPYING / COPYRIGHT / README). Preserved files are
 * kept as passive supporting content in skill subtrees: never classified
 * as an entity, but their bytes travel with the install so license terms
 * are honored and README context reaches the consumer.
 */
export function isPreservedBoilerplate(filename: string): boolean {
  return boilerplateKind(filename) === 'preserved';
}

/**
 * Returns true when `filename` is noise boilerplate (CONTRIBUTING,
 * CHANGELOG, CODE_OF_CONDUCT, …). Used by skill `listSupportingFiles` to
 * drop noise while preserving LICENSE/NOTICE/COPYING/README via
 * `!isNoiseBoilerplate(...)`.
 */
export function isNoiseBoilerplate(filename: string): boolean {
  return boilerplateKind(filename) === 'noise';
}

/** Returns true when `name` is a top-level dir excluded from skill staging. */
export function isRepoNonContentDir(name: string): boolean {
  return NON_CONTENT_DIRS.has(name);
}

/** Returns true when `name` is a non-markdown file excluded from skill staging. */
export function isRepoNonContentFile(name: string): boolean {
  return NON_CONTENT_FILES.has(name);
}
