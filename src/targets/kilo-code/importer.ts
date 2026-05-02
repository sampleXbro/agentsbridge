/**
 * Import Kilo Code config into canonical `.agentsmesh/`.
 *
 * Reads BOTH layouts so legacy users round-trip cleanly:
 *   - new   (`.kilo/...` + `AGENTS.md`) — declared in the descriptor.importer.
 *   - legacy (`.kilocode/...` + `.kilocodemodes`) — read by an imperative pass
 *     because the descriptor importer only supports one source per feature in
 *     the directory mode (see lessons L190 — `flatFile` cannot merge multiple
 *     sources, and `directory` mode would dedupe-collide on slug).
 *
 * Skill discovery walks both `.kilo/skills/` and `.kilocode/skills/`.
 */

import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { kiloNonRootRuleMapper, kiloCommandMapper } from './import-mappers.js';
import {
  KILO_CODE_TARGET,
  KILO_CODE_SKILLS_DIR,
  KILO_CODE_LEGACY_RULES_DIR,
  KILO_CODE_LEGACY_WORKFLOWS_DIR,
  KILO_CODE_LEGACY_SKILLS_DIR,
  KILO_CODE_LEGACY_MODES_FILE,
  KILO_CODE_CANONICAL_RULES_DIR,
  KILO_CODE_CANONICAL_COMMANDS_DIR,
  KILO_CODE_CANONICAL_AGENTS_DIR,
} from './constants.js';
import { descriptor } from './index.js';

type Normalizer = (content: string, sourceFile: string, destinationFile: string) => string;
const CANONICAL_ROOT_RULE_PATH = `${KILO_CODE_CANONICAL_RULES_DIR}/_root.md`;
const LEGACY_ROOT_RULE_FILE = '00-root.md';

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk `.kilocode/rules/*.md` and import as canonical rules. Reuses the same
 * non-root mapper as the new layout so behavior is identical.
 */
async function importLegacyRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalizer,
): Promise<void> {
  const srcDir = join(projectRoot, KILO_CODE_LEGACY_RULES_DIR);
  if (!(await pathExists(srcDir))) return;
  const destDir = join(projectRoot, KILO_CODE_CANONICAL_RULES_DIR);
  const rootSourceFile = join(srcDir, LEGACY_ROOT_RULE_FILE);
  const hasCurrentRoot = results.some((result) => result.toPath === CANONICAL_ROOT_RULE_PATH);
  const rootContent = hasCurrentRoot ? null : await readFileSafe(rootSourceFile);

  if (rootContent !== null) {
    const destPath = join(projectRoot, CANONICAL_ROOT_RULE_PATH);
    const normalized = normalize(rootContent, rootSourceFile, destPath);
    const { body } = parseFrontmatter(normalized);
    const serialized = await serializeImportedRuleWithFallback(destPath, { root: true }, body);
    await writeFileAtomic(destPath, serialized);
    results.push({
      feature: 'rules',
      fromTool: KILO_CODE_TARGET,
      fromPath: `${KILO_CODE_LEGACY_RULES_DIR}/${LEGACY_ROOT_RULE_FILE}`,
      toPath: CANONICAL_ROOT_RULE_PATH,
    });
  }

  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: KILO_CODE_TARGET,
      normalize,
      mapEntry: async ({ srcPath, relativePath, content, normalizeTo }) => {
        const mapping = await kiloNonRootRuleMapper({
          absolutePath: srcPath,
          relativePath,
          content,
          destDir,
          normalizeTo,
        });
        if (relativePath === LEGACY_ROOT_RULE_FILE) return null;
        if (!mapping) return null;
        return { ...mapping, feature: 'rules' };
      },
    })),
  );
}

/**
 * Walk `.kilocode/workflows/*.md` (legacy command directory) and import as
 * canonical commands.
 */
async function importLegacyWorkflows(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalizer,
): Promise<void> {
  const srcDir = join(projectRoot, KILO_CODE_LEGACY_WORKFLOWS_DIR);
  if (!(await pathExists(srcDir))) return;
  const destDir = join(projectRoot, KILO_CODE_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: KILO_CODE_TARGET,
      normalize,
      mapEntry: async ({ srcPath, relativePath, content, normalizeTo }) => {
        const mapping = await kiloCommandMapper({
          absolutePath: srcPath,
          relativePath,
          content,
          destDir,
          normalizeTo,
        });
        if (!mapping) return null;
        return { ...mapping, feature: 'commands' };
      },
    })),
  );
}

interface LegacyMode {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  roleDefinition?: unknown;
  whenToUse?: unknown;
}

interface LegacyModesFile {
  customModes?: unknown;
}

/**
 * Import `.kilocodemodes` (YAML or JSON) custom modes into
 * `.agentsmesh/agents/<slug>.md`. Translates the legacy roo/kilo
 * `roleDefinition` body into the canonical agent body.
 */
async function importLegacyModes(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalizer,
): Promise<void> {
  const sourceFile = join(projectRoot, KILO_CODE_LEGACY_MODES_FILE);
  const content = await readFileSafe(sourceFile);
  if (content === null) return;
  let parsed: LegacyModesFile;
  try {
    parsed = yamlParse(content) as LegacyModesFile;
  } catch {
    return;
  }
  if (!parsed || !Array.isArray(parsed.customModes)) return;
  for (const raw of parsed.customModes) {
    if (!raw || typeof raw !== 'object') continue;
    const mode = raw as LegacyMode;
    if (typeof mode.slug !== 'string' || mode.slug.length === 0) continue;
    const slug = mode.slug;
    const destPath = join(projectRoot, KILO_CODE_CANONICAL_AGENTS_DIR, `${slug}.md`);
    const description = typeof mode.description === 'string' ? mode.description : '';
    const role = typeof mode.roleDefinition === 'string' ? mode.roleDefinition.trim() : '';
    const whenToUse = typeof mode.whenToUse === 'string' ? mode.whenToUse.trim() : '';
    const body = whenToUse ? `${role}\n\n## When to use\n\n${whenToUse}` : role;
    // Only canonical agent fields are preserved by the shared serializer; the
    // kilo-specific `mode: subagent` frontmatter key is re-added by the
    // generator on round-trip.
    const frontmatter: Record<string, unknown> = {};
    if (description) frontmatter.description = description;
    if (typeof mode.name === 'string' && mode.name.length > 0) frontmatter.name = mode.name;
    const serialized = await serializeImportedAgentWithFallback(destPath, frontmatter, body);
    const normalized = normalize(serialized, sourceFile, destPath);
    await writeFileAtomic(destPath, normalized);
    results.push({
      feature: 'agents',
      fromTool: KILO_CODE_TARGET,
      fromPath: sourceFile,
      toPath: `${KILO_CODE_CANONICAL_AGENTS_DIR}/${slug}.md`,
    });
  }
}

export async function importFromKiloCode(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(KILO_CODE_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  // New-layout skills (.kilo/skills/) — covered first.
  await importEmbeddedSkills(
    projectRoot,
    KILO_CODE_SKILLS_DIR,
    KILO_CODE_TARGET,
    results,
    normalize,
  );

  // Project-only legacy passes — `.kilocode/` paths only exist in project scope.
  if (scope === 'project') {
    await importLegacyRules(projectRoot, results, normalize);
    await importLegacyWorkflows(projectRoot, results, normalize);
    await importLegacyModes(projectRoot, results, normalize);
    await importEmbeddedSkills(
      projectRoot,
      KILO_CODE_LEGACY_SKILLS_DIR,
      KILO_CODE_TARGET,
      results,
      normalize,
    );
  }

  return results;
}
