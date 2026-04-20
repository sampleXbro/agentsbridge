import { basename, dirname } from 'node:path';
import { serializeFrontmatter } from '../../utils/text/markdown.js';
import {
  readExistingFrontmatter,
  readHooks,
  readString,
  toStringArray,
  type ImportedCommandMetadata,
} from './import-metadata-core.js';

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
