import { basename, dirname } from 'node:path';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../../utils/text/markdown.js';
import { stripAgentsmeshRootInstructionParagraph } from '../projection/root-instruction-paragraph.js';

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

function readString(frontmatter: Record<string, unknown>, key: string): string | undefined {
  return typeof frontmatter[key] === 'string' ? frontmatter[key] : undefined;
}

function readHooks(frontmatter: Record<string, unknown>): Record<string, unknown> | undefined {
  const hooks = frontmatter.hooks;
  return hooks && typeof hooks === 'object' && !Array.isArray(hooks)
    ? (hooks as Record<string, unknown>)
    : undefined;
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
  const normalizedBody =
    basename(destinationPath, '.md') === '_root'
      ? stripAgentsmeshRootInstructionParagraph(body)
      : body.trim();
  const mergedFrontmatter = serializeCanonicalRuleFrontmatter(
    destinationPath,
    pruneUndefined({ ...existingFrontmatter, ...importedFrontmatter }),
  );
  const canonicalFrontmatter: Record<string, unknown> = {
    root: mergedFrontmatter.root === true,
    description:
      typeof mergedFrontmatter.description === 'string' ? mergedFrontmatter.description : '',
  };
  if (canonicalFrontmatter.root === false) {
    canonicalFrontmatter.globs = toStringArray(mergedFrontmatter.globs);
  }
  for (const [key, value] of Object.entries(mergedFrontmatter)) {
    if (key === 'root' || key === 'description' || key === 'globs' || value === undefined) continue;
    canonicalFrontmatter[key] = value;
  }
  return serializeFrontmatter(canonicalFrontmatter, normalizedBody || '');
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
    {
      description,
      'allowed-tools': allowedTools,
    },
    body.trim() || '',
  );
}

export async function serializeImportedSkillWithFallback(
  destinationPath: string,
  importedFrontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const existingFrontmatter = await readExistingFrontmatter(destinationPath);
  const derivedName = basename(dirname(destinationPath));
  const name =
    readString(importedFrontmatter, 'name') ??
    readString(existingFrontmatter, 'name') ??
    derivedName;
  const description =
    readString(importedFrontmatter, 'description') ??
    readString(existingFrontmatter, 'description') ??
    '';
  return serializeFrontmatter({ name, description }, body.trim() || '');
}

export async function serializeImportedAgentWithFallback(
  destinationPath: string,
  importedFrontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const existingFrontmatter = await readExistingFrontmatter(destinationPath);
  const tools = Object.prototype.hasOwnProperty.call(importedFrontmatter, 'tools')
    ? toStringArray(importedFrontmatter.tools)
    : (() => {
        const existingTools = toStringArray(existingFrontmatter.tools);
        return existingTools.length > 0 ? existingTools : [];
      })();
  const disallowedTools = Object.prototype.hasOwnProperty.call(
    importedFrontmatter,
    'disallowedTools',
  )
    ? toStringArray(importedFrontmatter.disallowedTools)
    : Object.prototype.hasOwnProperty.call(importedFrontmatter, 'disallowed-tools')
      ? toStringArray(importedFrontmatter['disallowed-tools'])
      : toStringArray(existingFrontmatter.disallowedTools);
  const mcpServers = Object.prototype.hasOwnProperty.call(importedFrontmatter, 'mcpServers')
    ? toStringArray(importedFrontmatter.mcpServers)
    : Object.prototype.hasOwnProperty.call(importedFrontmatter, 'mcp-servers')
      ? toStringArray(importedFrontmatter['mcp-servers'])
      : toStringArray(existingFrontmatter.mcpServers);
  const skills = Object.prototype.hasOwnProperty.call(importedFrontmatter, 'skills')
    ? toStringArray(importedFrontmatter.skills)
    : toStringArray(existingFrontmatter.skills);
  const maxTurnsRaw =
    importedFrontmatter.maxTurns ??
    importedFrontmatter['max-turns'] ??
    existingFrontmatter.maxTurns;
  const maxTurns = typeof maxTurnsRaw === 'number' ? maxTurnsRaw : Number(maxTurnsRaw ?? 0);
  const hooks = readHooks(importedFrontmatter) ?? readHooks(existingFrontmatter);

  const frontmatter: Record<string, unknown> = {
    name:
      readString(importedFrontmatter, 'name') ??
      readString(existingFrontmatter, 'name') ??
      basename(destinationPath, '.md'),
    description:
      readString(importedFrontmatter, 'description') ??
      readString(existingFrontmatter, 'description') ??
      '',
    tools,
  };
  if (disallowedTools.length > 0) frontmatter.disallowedTools = disallowedTools;
  const model =
    readString(importedFrontmatter, 'model') ?? readString(existingFrontmatter, 'model');
  if (model) frontmatter.model = model;
  const permissionMode =
    readString(importedFrontmatter, 'permissionMode') ??
    readString(importedFrontmatter, 'permission-mode') ??
    readString(existingFrontmatter, 'permissionMode') ??
    readString(existingFrontmatter, 'permission-mode');
  if (permissionMode) frontmatter.permissionMode = permissionMode;
  if (Number.isInteger(maxTurns) && maxTurns > 0) frontmatter.maxTurns = maxTurns;
  if (mcpServers.length > 0) frontmatter.mcpServers = mcpServers;
  if (hooks && Object.keys(hooks).length > 0) frontmatter.hooks = hooks;
  if (skills.length > 0) frontmatter.skills = skills;
  const memory =
    readString(importedFrontmatter, 'memory') ?? readString(existingFrontmatter, 'memory');
  if (memory) frontmatter.memory = memory;
  return serializeFrontmatter(frontmatter, body.trim() || '');
}
