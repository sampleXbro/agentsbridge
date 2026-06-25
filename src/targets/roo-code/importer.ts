import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { serializeImportedAgentWithFallback } from '../import/import-metadata.js';
import { rooNonRootRuleMapper } from './import-mappers.js';
import {
  ROO_CODE_TARGET,
  ROO_CODE_DIR,
  ROO_CODE_MODES_FILE,
  ROO_CODE_SKILLS_DIR,
  ROO_CODE_CANONICAL_RULES_DIR,
  ROO_CODE_CANONICAL_AGENTS_DIR,
} from './constants.js';
import { descriptor } from './index.js';

type Normalize = (content: string, sourceFile: string, destinationFile: string) => string;

/**
 * Import Roo custom modes (`.roomodes` YAML) back into canonical agents.
 * Each `customModes[]` entry maps to `.agentsmesh/agents/<slug>.md`
 * (slug → filename, name/description → frontmatter, roleDefinition → body).
 * Roo modes carry no tool list, so canonical `tools` round-trip as empty.
 */
async function importRooModes(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalize,
): Promise<void> {
  const srcPath = join(projectRoot, ROO_CODE_MODES_FILE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    return;
  }
  const modes = (parsed as { customModes?: unknown } | null)?.customModes;
  if (!Array.isArray(modes)) return;
  const destDir = join(projectRoot, ROO_CODE_CANONICAL_AGENTS_DIR);
  for (const mode of modes) {
    if (!mode || typeof mode !== 'object') continue;
    const m = mode as Record<string, unknown>;
    const slug =
      typeof m.slug === 'string' && m.slug
        ? m.slug
        : typeof m.name === 'string' && m.name
          ? m.name
          : null;
    if (!slug) continue;
    const name = typeof m.name === 'string' ? m.name : slug;
    const description = typeof m.description === 'string' ? m.description : '';
    const body = typeof m.roleDefinition === 'string' ? m.roleDefinition : '';
    const destPath = join(destDir, `${slug}.md`);
    const fileContent = await serializeImportedAgentWithFallback(
      destPath,
      { name, description, tools: [] },
      normalize(body, srcPath, destPath),
    );
    await mkdirp(dirname(destPath));
    await writeFileAtomic(destPath, fileContent);
    results.push({
      fromTool: ROO_CODE_TARGET,
      fromPath: srcPath,
      toPath: `${ROO_CODE_CANONICAL_AGENTS_DIR}/${slug}.md`,
      feature: 'agents',
    });
  }
}

/**
 * Roo can ship rule directories named `rules-<mode>`; the set is dynamic, so it
 * stays imperative. Each discovered directory is funneled through the same
 * non-root rule mapper used by the descriptor's primary rules spec.
 */
async function importPerModeRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const rooDir = join(projectRoot, ROO_CODE_DIR);
  let entries;
  try {
    entries = await readdir(rooDir, { withFileTypes: true });
  } catch {
    return;
  }
  const modeRuleDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('rules-'))
    .map((e) => e.name);
  const destDir = join(projectRoot, ROO_CODE_CANONICAL_RULES_DIR);
  for (const dirName of modeRuleDirs) {
    results.push(
      ...(await importFileDirectory({
        srcDir: join(rooDir, dirName),
        destDir,
        extensions: ['.md'],
        fromTool: ROO_CODE_TARGET,
        normalize,
        mapEntry: async ({ srcPath, relativePath, content, normalizeTo }) => {
          const mapping = await rooNonRootRuleMapper({
            absolutePath: srcPath,
            relativePath,
            content,
            destDir,
            normalizeTo,
          });
          if (!mapping) return null;
          return { ...mapping, feature: 'rules' };
        },
      })),
    );
  }
}

export async function importFromRooCode(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ROO_CODE_TARGET, projectRoot, scope);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));
  await importPerModeRules(projectRoot, results, normalize);
  // `.roomodes` is a project-only file; global custom modes live in VS Code globalStorage.
  if (scope === 'project') await importRooModes(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, ROO_CODE_SKILLS_DIR, ROO_CODE_TARGET, results, normalize);
  return results;
}
