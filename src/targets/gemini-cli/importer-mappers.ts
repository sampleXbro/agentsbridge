import { basename, join, relative } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import-metadata.js';
import type { ImportFileMapping } from '../import-orchestrator.js';
import { toGlobsArray, toToolsArray } from '../shared-import-helpers.js';
import { parseFlexibleFrontmatter } from './format-helpers.js';

const AGENTSBRIDGE_RULES = '.agentsbridge/rules';
const AGENTSBRIDGE_COMMANDS = '.agentsbridge/commands';

export async function mapGeminiRuleFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const destFileName = `${basename(srcPath, '.md')}.md`;
  const destPath = join(destDir, destFileName);
  const { frontmatter, body } = parseFlexibleFrontmatter(normalizeTo(destPath));
  const globs = toGlobsArray(frontmatter.globs);
  const canonicalFm: Record<string, unknown> = {
    root: false,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    globs: globs.length > 0 ? globs : undefined,
  };
  Object.keys(canonicalFm).forEach((key) => {
    if (canonicalFm[key] === undefined) delete canonicalFm[key];
  });
  return {
    destPath,
    toPath: `${AGENTSBRIDGE_RULES}/${destFileName}`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
  };
}

export async function mapGeminiCommandFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
  geminiCommandsRoot: string,
): Promise<ImportFileMapping> {
  const rel = relative(geminiCommandsRoot, srcPath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(toml|md)$/i, '');
  const name = noExt.split('/').filter(Boolean).join(':');
  const destPath = join(destDir, `${name}.md`);
  const normalized = normalizeTo(destPath);
  const { frontmatter, body } = srcPath.endsWith('.toml')
    ? parseTomlCommand(normalized)
    : parseFlexibleFrontmatter(normalized);
  const fromCamel = toToolsArray(frontmatter.allowedTools);
  const fromKebab = toToolsArray(frontmatter['allowed-tools']);
  const allowedTools = fromCamel.length > 0 ? fromCamel : fromKebab;
  return {
    destPath,
    toPath: `${AGENTSBRIDGE_COMMANDS}/${name}.md`,
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

function parseTomlCommand(normalized: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  try {
    const parsed = parseToml(normalized) as Record<string, unknown>;
    return {
      frontmatter: parsed,
      body: typeof parsed.prompt === 'string' ? parsed.prompt : '',
    };
  } catch {
    return { frontmatter: {}, body: normalized.trim() };
  }
}
