/**
 * Copilot target importer — .github/copilot-instructions.md, .github/copilot/*.instructions.md (legacy),
 * .github/instructions/*.instructions.md, .github/prompts/*.prompt.md, .github/skills/**,
 * .github/agents/*.agent.md, .github/hooks/*.json (and legacy .github/copilot-hooks/*.sh) → canonical
 * .agentsmesh/.
 */

import { join, basename } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/import-reference-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import { importFileDirectory } from '../import-orchestrator.js';
import { toGlobsArray } from '../shared-import-helpers.js';
import {
  COPILOT_TARGET,
  COPILOT_INSTRUCTIONS,
  COPILOT_CONTEXT_DIR,
  COPILOT_INSTRUCTIONS_DIR,
  COPILOT_PROMPTS_DIR,
  COPILOT_CANONICAL_RULES_DIR,
  COPILOT_CANONICAL_COMMANDS_DIR,
} from './constants.js';
import { parseCommandPromptFrontmatter, serializeImportedCommand } from './command-prompt.js';
import { importHooks } from './hook-parser.js';
import { importAgents, importSkills } from './agents-skills-helpers.js';

/**
 * Import Copilot rules into canonical .agentsmesh/rules.
 * Sources: .github/copilot-instructions.md (root) and .github/copilot/*.instructions.md.
 * Strips .instructions suffix for slug. Preserves description and globs.
 *
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromCopilot(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(COPILOT_TARGET, projectRoot);
  const destDir = join(projectRoot, COPILOT_CANONICAL_RULES_DIR);

  const instructionsPath = join(projectRoot, COPILOT_INSTRUCTIONS);
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

  const copilotDir = join(projectRoot, COPILOT_CONTEXT_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: copilotDir,
      destDir,
      extensions: ['.instructions.md'],
      fromTool: 'copilot',
      normalize,
      mapEntry: async ({ srcPath, normalizeTo }) => {
        const destFileName = `${basename(srcPath, '.instructions.md')}.md`;
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
      mapEntry: async ({ srcPath, normalizeTo }) => {
        const base = srcPath.endsWith('.instructions.md')
          ? basename(srcPath, '.instructions.md')
          : basename(srcPath, '.md');
        const destPath = join(destDir, `${base}.md`);
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
          toPath: `${COPILOT_CANONICAL_RULES_DIR}/${base}.md`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
        };
      },
    })),
  );

  await importCommands(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importSkills(projectRoot, results, normalize);
  await importHooks(projectRoot, results);

  return results;
}

async function importCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const promptsDir = join(projectRoot, COPILOT_PROMPTS_DIR);
  const destDir = join(projectRoot, COPILOT_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: promptsDir,
      destDir,
      extensions: ['.prompt.md'],
      fromTool: 'copilot',
      normalize,
      mapEntry: ({ srcPath, content }) => {
        const previewDest = join(destDir, `${basename(srcPath, '.prompt.md')}.md`);
        const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, previewDest));
        const command = parseCommandPromptFrontmatter(frontmatter, srcPath);
        const destPath = join(destDir, `${command.name}.md`);
        return {
          destPath,
          toPath: `${COPILOT_CANONICAL_COMMANDS_DIR}/${command.name}.md`,
          feature: 'commands',
          content: serializeImportedCommand(command, body),
        };
      },
    })),
  );
}
