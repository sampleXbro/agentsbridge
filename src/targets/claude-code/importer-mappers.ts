import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import type { ImportFileMapping } from '../import-orchestrator.js';

const AB_RULES = '.agentsbridge/rules';
const AB_COMMANDS = '.agentsbridge/commands';
const AB_AGENTS = '.agentsbridge/agents';

export async function mapClaudeRuleFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const name = basename(srcPath, '.md');
  const destPath = join(destDir, `${name}.md`);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${AB_RULES}/${name}.md`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(
      destPath,
      { ...frontmatter, root: false },
      body,
    ),
  };
}

export function mapClaudeMarkdownFile(
  srcPath: string,
  destDir: string,
  feature: 'commands' | 'agents',
  normalizeTo: (destinationFile: string) => string,
): ImportFileMapping {
  const name = basename(srcPath, '.md');
  const destPath = join(destDir, `${name}.md`);
  const basePath = feature === 'commands' ? AB_COMMANDS : AB_AGENTS;
  return {
    destPath,
    toPath: `${basePath}/${name}.md`,
    feature,
    content: normalizeTo(destPath),
  };
}
