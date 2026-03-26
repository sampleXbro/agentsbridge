import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/markdown.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import-metadata.js';
import type { ImportFileMapping } from '../import-orchestrator.js';
import { toToolsArray } from '../shared-import-helpers.js';
import {
  CURSOR_CANONICAL_RULES_DIR,
  CURSOR_CANONICAL_COMMANDS_DIR,
  CURSOR_CANONICAL_AGENTS_DIR,
} from './constants.js';

export async function mapCursorRuleFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
  onRootRule: () => void,
): Promise<ImportFileMapping> {
  const name = basename(srcPath, '.mdc');
  const destPath = join(destDir, `${name}.md`);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const isRoot = frontmatter.alwaysApply === true;
  if (isRoot) onRootRule();
  const canonicalFm = { ...frontmatter, root: isRoot };
  delete (canonicalFm as Record<string, unknown>).alwaysApply;
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_RULES_DIR}/${name}.md`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
  };
}

export async function mapCursorCommandFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const name = basename(srcPath, '.md');
  const destPath = join(destDir, `${name}.md`);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const fromCamel = toToolsArray(frontmatter.allowedTools);
  const allowedTools =
    fromCamel.length > 0 ? fromCamel : toToolsArray(frontmatter['allowed-tools']);
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_COMMANDS_DIR}/${name}.md`,
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

export function mapCursorAgentFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): ImportFileMapping {
  const name = basename(srcPath, '.md');
  const destPath = join(destDir, `${name}.md`);
  return {
    destPath,
    toPath: `${CURSOR_CANONICAL_AGENTS_DIR}/${name}.md`,
    feature: 'agents',
    content: normalizeTo(destPath),
  };
}
