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
  CURSOR_CANONICAL_RULES_DIR,
  CURSOR_CANONICAL_COMMANDS_DIR,
  CURSOR_CANONICAL_AGENTS_DIR,
} from './constants.js';

export async function mapCursorRuleFile(
  relativePath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
  onRootRule: () => void,
): Promise<ImportFileMapping> {
  const rawRelativePath = relativePath.replace(/\.mdc$/i, '.md');
  const rawDestPath = join(destDir, rawRelativePath);
  const initial = parseFrontmatter(normalizeTo(rawDestPath));
  const isRoot = initial.frontmatter.alwaysApply === true;
  const destPath = isRoot ? join(destDir, '_root.md') : rawDestPath;
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  if (isRoot) onRootRule();
  const canonicalFm = { ...frontmatter, root: isRoot };
  delete (canonicalFm as Record<string, unknown>).alwaysApply;
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_RULES_DIR}/${isRoot ? '_root.md' : rawRelativePath}`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
  };
}

export async function mapCursorCommandFile(
  relativePath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const fromCamel = toToolsArray(frontmatter.allowedTools);
  const allowedTools =
    fromCamel.length > 0 ? fromCamel : toToolsArray(frontmatter['allowed-tools']);
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_COMMANDS_DIR}/${relativePath}`,
    feature: 'commands',
    content: await serializeImportedCommandWithFallback(
      destPath,
      {
        description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
        hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
        allowedTools,
        hasAllowedTools:
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowedTools') ||
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowed-tools'),
      },
      body,
    ),
  };
}

export async function mapCursorAgentFile(
  relativePath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_AGENTS_DIR}/${relativePath}`,
    feature: 'agents',
    content: await serializeImportedAgentWithFallback(destPath, frontmatter, body),
  };
}
