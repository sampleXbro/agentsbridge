/**
 * Copilot target importer — .github/copilot-instructions.md, .github/copilot/*.instructions.md (legacy),
 * .github/instructions/*.instructions.md, .github/prompts/*.prompt.md, .github/skills/**,
 * .github/agents/*.agent.md, .github/hooks/*.json (and legacy .github/copilot-hooks/*.sh) → canonical
 * .agentsmesh/.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { toGlobsArray } from '../import/shared-import-helpers.js';
import {
  COPILOT_TARGET,
  COPILOT_INSTRUCTIONS,
  COPILOT_CONTEXT_DIR,
  COPILOT_INSTRUCTIONS_DIR,
  COPILOT_PROMPTS_DIR,
  COPILOT_AGENTS_DIR,
  COPILOT_SKILLS_DIR,
  COPILOT_GLOBAL_INSTRUCTIONS,
  COPILOT_GLOBAL_PROMPTS_DIR,
  COPILOT_GLOBAL_AGENTS_DIR,
  COPILOT_GLOBAL_SKILLS_DIR,
  COPILOT_CANONICAL_RULES_DIR,
} from './constants.js';
import { importHooks } from './hook-parser.js';
import { importCopilotCommands } from './importer-commands.js';
import { importAgents } from './importer-agents.js';
import { importSkills } from './skills-adapter.js';

/**
 * Import Copilot rules into canonical .agentsmesh/rules.
 * Sources: .github/copilot-instructions.md (root) and .github/copilot/*.instructions.md.
 * Strips .instructions suffix for slug. Preserves description and globs.
 *
 * @param projectRoot - Project root directory (repo root, or user home for `scope: 'global'`)
 * @param options - `scope: 'global'` reads from `~/.copilot/` native paths instead of `.github/`
 * @returns Import results for each imported file
 */
export async function importFromCopilot(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(COPILOT_TARGET, projectRoot, scope);
  const destDir = join(projectRoot, COPILOT_CANONICAL_RULES_DIR);

  const instructionsRel = scope === 'global' ? COPILOT_GLOBAL_INSTRUCTIONS : COPILOT_INSTRUCTIONS;
  const instructionsPath = join(projectRoot, instructionsRel);
  const instructionsContent = await readFileSafe(instructionsPath);
  if (instructionsContent !== null) {
    await mkdirp(destDir);
    const destPath = join(destDir, '_root.md');
    const { frontmatter, body } = parseFrontmatter(
      normalize(instructionsContent, instructionsPath, destPath),
    );
    const hasRoot = frontmatter.root === true;
    const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
    const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'copilot',
      fromPath: instructionsPath,
      toPath: `${COPILOT_CANONICAL_RULES_DIR}/_root.md`,
      feature: 'rules',
    });
  }

  if (scope === 'project') {
    const copilotDir = join(projectRoot, COPILOT_CONTEXT_DIR);
    results.push(
      ...(await importFileDirectory({
        srcDir: copilotDir,
        destDir,
        extensions: ['.instructions.md'],
        fromTool: 'copilot',
        normalize,
        mapEntry: async ({ relativePath, normalizeTo }) => {
          const destFileName = relativePath.replace(/\.instructions\.md$/i, '.md');
          const destPath = join(destDir, destFileName);
          const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
          const globs = toGlobsArray(frontmatter.globs);
          const canonicalFm: Record<string, unknown> = {
            root: false,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            globs: globs.length > 0 ? globs : undefined,
          };
          Object.keys(canonicalFm).forEach((key) => {
            if (canonicalFm[key] === undefined) delete canonicalFm[key];
          });
          return {
            destPath,
            toPath: `${COPILOT_CANONICAL_RULES_DIR}/${destFileName}`,
            feature: 'rules',
            content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
          };
        },
      })),
    );

    // New path: .github/instructions/*.md (uses applyTo key instead of globs)
    const newInstDir = join(projectRoot, COPILOT_INSTRUCTIONS_DIR);
    results.push(
      ...(await importFileDirectory({
        srcDir: newInstDir,
        destDir,
        extensions: ['.instructions.md', '.md'],
        fromTool: 'copilot',
        normalize,
        mapEntry: async ({ relativePath, normalizeTo }) => {
          const relativeMdPath = relativePath.endsWith('.instructions.md')
            ? relativePath.replace(/\.instructions\.md$/i, '.md')
            : relativePath;
          const destPath = join(destDir, relativeMdPath);
          const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
          const globs = toGlobsArray(
            frontmatter.applyTo !== undefined ? frontmatter.applyTo : frontmatter.globs,
          );
          const canonicalFm: Record<string, unknown> = {
            root: false,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            globs: globs.length > 0 ? globs : undefined,
          };
          Object.keys(canonicalFm).forEach((key) => {
            if (canonicalFm[key] === undefined) delete canonicalFm[key];
          });
          return {
            destPath,
            toPath: `${COPILOT_CANONICAL_RULES_DIR}/${relativeMdPath}`,
            feature: 'rules',
            content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
          };
        },
      })),
    );
  }

  const promptsDirRel = scope === 'global' ? COPILOT_GLOBAL_PROMPTS_DIR : COPILOT_PROMPTS_DIR;
  await importCopilotCommands(projectRoot, results, normalize, promptsDirRel);
  await importAgents(
    projectRoot,
    results,
    normalize,
    scope === 'global' ? COPILOT_GLOBAL_AGENTS_DIR : COPILOT_AGENTS_DIR,
  );
  await importSkills(
    projectRoot,
    results,
    normalize,
    scope === 'global' ? COPILOT_GLOBAL_SKILLS_DIR : COPILOT_SKILLS_DIR,
  );
  if (scope === 'project') {
    await importHooks(projectRoot, results);
  }

  return results;
}
