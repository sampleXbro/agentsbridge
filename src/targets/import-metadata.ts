import { basename } from 'node:path';
import { readFileSafe } from '../utils/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../utils/markdown.js';

export interface ImportedCommandMetadata {
  description?: string;
  hasDescription: boolean;
  allowedTools?: string[];
  hasAllowedTools: boolean;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

async function readExistingFrontmatter(path: string): Promise<Record<string, unknown>> {
  const existing = await readFileSafe(path);
  if (!existing) return {};
  return parseFrontmatter(existing).frontmatter;
}

function pruneUndefined(frontmatter: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(frontmatter).filter(([, value]) => value !== undefined));
}

function serializeCanonicalRuleFrontmatter(
  destinationPath: string,
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const isRootRule = basename(destinationPath, '.md') === '_root';
  const rest = { ...frontmatter };
  delete (rest as Record<string, unknown>).root;
  return {
    root: isRootRule,
    ...rest,
  };
}

export async function serializeImportedRuleWithFallback(
  destinationPath: string,
  importedFrontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const existingFrontmatter = await readExistingFrontmatter(destinationPath);
  const mergedFrontmatter = serializeCanonicalRuleFrontmatter(
    destinationPath,
    pruneUndefined({ ...existingFrontmatter, ...importedFrontmatter }),
  );
  return serializeFrontmatter(mergedFrontmatter, body.trim() || '');
}

export async function serializeImportedCommandWithFallback(
  destinationPath: string,
  imported: ImportedCommandMetadata,
  body: string,
): Promise<string> {
  const existingFrontmatter = await readExistingFrontmatter(destinationPath);
  const existingAllowedTools = (() => {
    const fromCamel = toStringArray(existingFrontmatter.allowedTools);
    return fromCamel.length > 0 ? fromCamel : toStringArray(existingFrontmatter['allowed-tools']);
  })();
  const description = imported.hasDescription
    ? (imported.description ?? '')
    : typeof existingFrontmatter.description === 'string'
      ? existingFrontmatter.description
      : '';
  const allowedTools = imported.hasAllowedTools
    ? (imported.allowedTools ?? [])
    : existingAllowedTools;

  return serializeFrontmatter(
    pruneUndefined({
      description: description || undefined,
      'allowed-tools': allowedTools.length > 0 ? allowedTools : undefined,
    }),
    body.trim() || '',
  );
}
