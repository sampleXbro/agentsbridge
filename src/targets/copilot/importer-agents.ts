/**
 * Import Copilot `.github/agents/*.agent.md` into canonical `.agentsmesh/agents/`.
 */

import { join, basename, dirname, relative } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedAgentWithFallback } from '../import/import-metadata.js';
import { COPILOT_TARGET, COPILOT_AGENTS_DIR, COPILOT_CANONICAL_AGENTS_DIR } from './constants.js';

export async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  agentsDirRel: string = COPILOT_AGENTS_DIR,
): Promise<void> {
  const agentsDir = join(projectRoot, agentsDirRel);
  let files: string[];
  try {
    files = await readDirRecursive(agentsDir);
  } catch {
    return;
  }
  const agentFiles = files.filter((f) => f.endsWith('.agent.md'));
  const destDir = join(projectRoot, COPILOT_CANONICAL_AGENTS_DIR);
  for (const srcPath of agentFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const relativePath = relative(agentsDir, srcPath).replace(/\\/g, '/');
    const relativeMdPath = relativePath.replace(/\.agent\.md$/i, '.md');
    const base = basename(relativeMdPath, '.md');
    const destPath = join(destDir, relativeMdPath);
    await mkdirp(dirname(destPath));
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    const outContent = await serializeImportedAgentWithFallback(
      destPath,
      {
        ...frontmatter,
        name: typeof frontmatter.name === 'string' ? frontmatter.name : base,
      },
      body,
    );
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: COPILOT_TARGET,
      fromPath: srcPath,
      toPath: `${COPILOT_CANONICAL_AGENTS_DIR}/${relativeMdPath}`,
      feature: 'agents',
    });
  }
}
