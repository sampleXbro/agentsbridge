/**
 * OpenCode-specific entry mappers for the descriptor-driven import runner.
 *
 * Lives in a sibling file (not `importer.ts`) to avoid the
 * `index.ts <-> importer.ts` TDZ trap: object literals capture references
 * eagerly at module init, so descriptor-referenced mappers must come from a
 * file that does NOT import `index.ts`.
 */

import { join } from 'node:path';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import type { ImportEntryMapper } from '../catalog/import-descriptor.js';
import { mapOpenCodePermissionToAgentTools } from './permission-map.js';
import {
  OPENCODE_CANONICAL_AGENTS_DIR,
  OPENCODE_CANONICAL_COMMANDS_DIR,
  OPENCODE_CANONICAL_RULES_DIR,
} from './constants.js';

export const opencodeNonRootRuleMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${OPENCODE_CANONICAL_RULES_DIR}/${relativePath}`,
    content: await serializeImportedRuleWithFallback(
      destPath,
      {
        root: false,
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
      },
      body,
    ),
  };
};

export const opencodeCommandMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${OPENCODE_CANONICAL_COMMANDS_DIR}/${relativePath}`,
    content: await serializeImportedCommandWithFallback(
      destPath,
      {
        hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        hasAllowedTools: false,
        allowedTools: [],
      },
      body,
    ),
  };
};

/**
 * OpenCode agents carry a `permission` object, not `tools`/`disallowedTools`
 * arrays (see generator.ts / permission-map.ts). Translate `permission` back
 * into the canonical `tools`/`disallowedTools` shape the shared serializer
 * expects, so tool restrictions survive a generate -> import round trip.
 */
export const opencodeAgentMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const mapped: Record<string, unknown> = { ...frontmatter };
  if (Object.prototype.hasOwnProperty.call(frontmatter, 'permission')) {
    const { tools, disallowedTools } = mapOpenCodePermissionToAgentTools(frontmatter.permission);
    mapped.tools = tools;
    mapped.disallowedTools = disallowedTools;
  }
  return {
    destPath,
    toPath: `${OPENCODE_CANONICAL_AGENTS_DIR}/${relativePath}`,
    content: await serializeImportedAgentWithFallback(destPath, mapped, body),
  };
};
