import { join } from 'node:path';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import type { ImportFileMapping } from '../import/import-orchestrator.js';
import { toToolsArray } from '../import/shared-import-helpers.js';
import {
  CLAUDE_CANONICAL_RULES_DIR,
  CLAUDE_CANONICAL_COMMANDS_DIR,
  CLAUDE_CANONICAL_AGENTS_DIR,
} from './constants.js';

export async function mapClaudeRuleFile(
  relativePath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${CLAUDE_CANONICAL_RULES_DIR}/${relativePath}`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(
      destPath,
      { ...frontmatter, root: false },
      body,
    ),
  };
}

export async function mapClaudeMarkdownFile(
  relativePath: string,
  destDir: string,
  feature: 'commands' | 'agents',
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const basePath =
    feature === 'commands' ? CLAUDE_CANONICAL_COMMANDS_DIR : CLAUDE_CANONICAL_AGENTS_DIR;
  return {
    destPath,
    toPath: `${basePath}/${relativePath}`,
    feature,
    content:
      feature === 'commands'
        ? await serializeImportedCommandWithFallback(
            destPath,
            {
              description:
                typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
              hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
              allowedTools: (() => {
                const fromCamel = toToolsArray(frontmatter.allowedTools);
                return fromCamel.length > 0
                  ? fromCamel
                  : toToolsArray(frontmatter['allowed-tools']);
              })(),
              hasAllowedTools:
                Object.prototype.hasOwnProperty.call(frontmatter, 'allowedTools') ||
                Object.prototype.hasOwnProperty.call(frontmatter, 'allowed-tools'),
            },
            body,
          )
        : await serializeImportedAgentWithFallback(destPath, frontmatter, body),
  };
}
