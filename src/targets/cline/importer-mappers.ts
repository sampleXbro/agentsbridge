import { basename, join } from 'node:path';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import type { ImportFileMapping } from '../import/import-orchestrator.js';
import { toGlobsArray } from '../import/shared-import-helpers.js';
import { CLINE_CANONICAL_RULES_DIR, CLINE_CANONICAL_COMMANDS_DIR } from './constants.js';

export async function mapClineRuleFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping | null> {
  if (srcPath.includes('/workflows/')) return null;
  const name = basename(srcPath, '.md');
  if (name === '_root') return null;
  const destPath = join(destDir, `${name}.md`);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const globs = toGlobsArray(frontmatter.paths ?? frontmatter.globs);
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
    toPath: `${CLINE_CANONICAL_RULES_DIR}/${name}.md`,
    feature: 'rules',
    content: await serializeImportedRuleWithFallback(destPath, canonicalFm, body),
  };
}

export async function mapClineWorkflowFile(
  srcPath: string,
  destDir: string,
  normalizeTo: (destinationFile: string) => string,
): Promise<ImportFileMapping> {
  const name = basename(srcPath, '.md');
  const destPath = join(destDir, `${name}.md`);
  const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
  const hasFrontmatterDescription = Object.prototype.hasOwnProperty.call(
    frontmatter,
    'description',
  );
  let description = hasFrontmatterDescription
    ? typeof frontmatter.description === 'string'
      ? frontmatter.description
      : ''
    : '';
  let hasDescription = hasFrontmatterDescription;
  let actualBody = body;

  // Cline workflows embed description as first paragraph (no frontmatter).
  // Split "desc\n\nbody" back into separate fields when no frontmatter description present.
  if (!hasDescription) {
    const doubleNewline = body.indexOf('\n\n');
    if (doubleNewline > 0) {
      const firstParagraph = body.slice(0, doubleNewline).trim();
      if (firstParagraph && !firstParagraph.includes('\n')) {
        description = firstParagraph;
        hasDescription = true;
        actualBody = body.slice(doubleNewline + 2);
      }
    }
  }

  return {
    destPath,
    toPath: `${CLINE_CANONICAL_COMMANDS_DIR}/${name}.md`,
    feature: 'commands',
    content: await serializeImportedCommandWithFallback(
      destPath,
      {
        description,
        hasDescription,
        allowedTools: [],
        hasAllowedTools:
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowedTools') ||
          Object.prototype.hasOwnProperty.call(frontmatter, 'allowed-tools'),
      },
      actualBody,
    ),
  };
}
