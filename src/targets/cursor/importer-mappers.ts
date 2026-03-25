import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/markdown.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import-metadata.js';
import type { ImportFileMapping } from '../import-orchestrator.js';
import { toToolsArray } from '../shared-import-helpers.js';

const AB_RULES = '.agentsbridge/rules';
const AB_COMMANDS = '.agentsbridge/commands';
const AB_AGENTS = '.agentsbridge/agents';

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
    toPath: `${AB_RULES}/${name}.md`,
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
    toPath: `${AB_COMMANDS}/${name}.md`,
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
    toPath: `${AB_AGENTS}/${name}.md`,
    feature: 'agents',
    content: normalizeTo(destPath),
  };
}
