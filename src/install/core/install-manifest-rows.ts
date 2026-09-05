/**
 * Row-tolerant `installs.yaml` I/O: valid rows are returned typed, rejected
 * rows are kept verbatim so rewrites never drop them, and a file that cannot
 * be parsed at all is reported instead of being replaced.
 */

import { join } from 'node:path';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import type { z } from 'zod';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { prependYamlSchemaDirective } from '../../utils/output/schema-directive.js';
import {
  installManifestEntrySchema,
  installManifestEnvelopeSchema,
  type InstallManifestEntry,
} from './install-manifest-schema.js';
import { normalizePersistedInstallPaths } from './portable-paths.js';

export interface InstallManifestRows {
  installs: InstallManifestEntry[];
  /** Rows that failed validation, carried through rewrites untouched. */
  rejected: unknown[];
  /** Set when the file is not a readable manifest; writers must not rewrite it. */
  parseError?: string;
}

export function installManifestPath(canonicalDir: string): string {
  return join(canonicalDir, 'installs.yaml');
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.map(String).join('.')}: ${issue.message}`
        : issue.message,
    )
    .join('; ');
}

function rowLabel(row: unknown, index: number): string {
  const name = typeof row === 'object' && row !== null && 'name' in row ? row.name : undefined;
  return typeof name === 'string' && name.length > 0 ? `"${name}"` : `#${index + 1}`;
}

function parseDocument(content: string): { doc: unknown } | { parseError: string } {
  try {
    return { doc: parseYaml(content) as unknown };
  } catch (error) {
    return { parseError: error instanceof Error ? error.message : String(error) };
  }
}

export async function loadInstallManifestRows(canonicalDir: string): Promise<InstallManifestRows> {
  const content = await readFileSafe(installManifestPath(canonicalDir));
  if (content === null) return { installs: [], rejected: [] };

  const parsed = parseDocument(content);
  if ('parseError' in parsed) return { installs: [], rejected: [], parseError: parsed.parseError };
  if (parsed.doc === null || parsed.doc === undefined) return { installs: [], rejected: [] };

  const envelope = installManifestEnvelopeSchema.safeParse(parsed.doc);
  if (!envelope.success) {
    return { installs: [], rejected: [], parseError: formatIssues(envelope.error) };
  }

  const installs: InstallManifestEntry[] = [];
  const rejected: unknown[] = [];
  envelope.data.installs.forEach((row, index) => {
    const entry = installManifestEntrySchema.safeParse(row);
    if (entry.success) {
      installs.push(normalizePersistedInstallPaths(entry.data));
      return;
    }
    rejected.push(row);
    logger.warn(
      `installs.yaml: skipping invalid install ${rowLabel(row, index)} (${formatIssues(entry.error)})`,
    );
  });
  return { installs, rejected };
}

export function serializeInstallManifest(
  installs: InstallManifestEntry[],
  rejected: unknown[],
): string {
  const sorted = [...installs].sort((a, b) => a.name.localeCompare(b.name));
  return prependYamlSchemaDirective(
    yamlStringify({ version: 1, installs: [...sorted, ...rejected] }),
    'installs',
  );
}
