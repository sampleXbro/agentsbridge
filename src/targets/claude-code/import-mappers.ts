/**
 * Claude Code-specific entry mappers for the descriptor-driven import runner.
 * Sibling-file pattern avoids the `index.ts ↔ importer.ts` TDZ trap.
 */

import { join } from 'node:path';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import { toToolsArray } from '../import/shared-import-helpers.js';
import type { ImportEntryMapper } from '../catalog/import-descriptor.js';
import {
  CLAUDE_CANONICAL_AGENTS_DIR,
  CLAUDE_CANONICAL_COMMANDS_DIR,
  CLAUDE_CANONICAL_RULES_DIR,
} from './constants.js';

/** Non-root Claude rules pass frontmatter through and force `root: false`. */
export const claudeRuleMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${CLAUDE_CANONICAL_RULES_DIR}/${relativePath}`,
    content: await serializeImportedRuleWithFallback(
      destPath,
      { ...frontmatter, root: false },
      body,
    ),
  };
};

/** Claude commands accept either `allowedTools` (camel) or `allowed-tools` (kebab). */
export const claudeCommandMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const fromCamel = toToolsArray(frontmatter.allowedTools);
  const allowedTools =
    fromCamel.length > 0 ? fromCamel : toToolsArray(frontmatter['allowed-tools']);
  return {
    destPath,
    toPath: `${CLAUDE_CANONICAL_COMMANDS_DIR}/${relativePath}`,
    content: await serializeImportedCommandWithFallback(
      destPath,
      {
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        hasDescription: Object.prototype.hasOwnProperty.call(frontmatter, 'description'),
        allowedTools,
        hasAllowedTools:
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowedTools') ||
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowed-tools'),
      },
      body,
    ),
  };
};

/** Claude agents are passthrough — every frontmatter key is preserved. */
export const claudeAgentMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${CLAUDE_CANONICAL_AGENTS_DIR}/${relativePath}`,
    content: await serializeImportedAgentWithFallback(destPath, frontmatter, body),
  };
};
