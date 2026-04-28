/**
 * Antigravity-specific entry mappers for the descriptor-driven import runner.
 *
 * Lives in its own file so the descriptor in `index.ts` can reference the
 * mappers without forming a circular import chain through `importer.ts`
 * (importer → index → importer would leave these bindings as `undefined`
 * during the descriptor literal's evaluation).
 */

import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import type { ImportEntryMapper } from '../catalog/import-descriptor.js';
import {
  ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
  ANTIGRAVITY_CANONICAL_RULES_DIR,
} from './constants.js';

/** Skips `general.md` (root) and the legacy `_root.md` file before serialization. */
export const nonRootRuleMapper: ImportEntryMapper = async ({
  relativePath,
  normalizeTo,
  destDir,
}) => {
  if (basename(relativePath) === 'general.md' || basename(relativePath) === '_root.md') return null;
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${ANTIGRAVITY_CANONICAL_RULES_DIR}/${relativePath}`,
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

/** Antigravity workflows carry only `description` — no `allowed-tools` field, unlike normal commands. */
export const workflowMapper: ImportEntryMapper = async ({ relativePath, normalizeTo, destDir }) => {
  const destPath = join(destDir, relativePath);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  return {
    destPath,
    toPath: `${ANTIGRAVITY_CANONICAL_COMMANDS_DIR}/${relativePath}`,
    content: await serializeImportedCommandWithFallback(
      destPath,
      {
        hasDescription: typeof frontmatter.description === 'string',
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        hasAllowedTools: false,
        allowedTools: [],
      },
      body,
    ),
  };
};
