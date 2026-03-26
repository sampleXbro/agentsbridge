import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import type { ImportFileMapping } from '../import-orchestrator.js';
import {
  CLAUDE_CANONICAL_RULES_DIR,
  CLAUDE_CANONICAL_COMMANDS_DIR,
  CLAUDE_CANONICAL_AGENTS_DIR,
} from './constants.js';

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
    toPath: `${CLAUDE_CANONICAL_RULES_DIR}/${name}.md`,
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
  const basePath =
    feature === 'commands' ? CLAUDE_CANONICAL_COMMANDS_DIR : CLAUDE_CANONICAL_AGENTS_DIR;
  return {
    destPath,
    toPath: `${basePath}/${name}.md`,
    feature,
    content: normalizeTo(destPath),
  };
}
