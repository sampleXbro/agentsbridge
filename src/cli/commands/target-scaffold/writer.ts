/**
 * Writer for agentsmesh target scaffold command.
 * Emits 10 files: target source files + tests + fixture.
 */

import { join } from 'node:path';
import { exists, writeFileAtomic } from '../../../utils/filesystem/fs.js';
import { TARGET_IDS } from '../../../targets/catalog/target-ids.js';
import {
  TEMPLATE_CONSTANTS,
  TEMPLATE_INDEX,
  TEMPLATE_GENERATOR,
  TEMPLATE_IMPORTER,
  TEMPLATE_LINTER,
  TEMPLATE_LINT_HOOKS,
  TEMPLATE_IMPORT_MAP,
  TEMPLATE_GENERATOR_TEST,
  TEMPLATE_IMPORTER_TEST,
  TEMPLATE_FIXTURE_ROOT_MD,
} from './templates.js';

export interface ScaffoldOptions {
  /** Target ID, e.g. 'kilo-code' */
  id: string;
  /** Human-readable name, defaults to id */
  displayName?: string;
  /** Absolute path to project root (process.cwd()) */
  projectRoot: string;
  /** Overwrite existing files */
  force?: boolean;
}

export interface ScaffoldResult {
  /** Absolute paths written */
  written: string[];
  /** Files that existed and were skipped (no --force) */
  skipped: string[];
  /** Human-readable next-step instructions */
  postSteps: string[];
}

const ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Emit a complete target skeleton (10 files) for the given options.
 */
export async function writeTargetScaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const { id, projectRoot, force = false } = opts;
  const displayName = opts.displayName ?? id;
  const v = { id, displayName };

  // ── Validation ────────────────────────────────────────────────────────────
  if (!ID_RE.test(id)) {
    throw new Error(
      `Invalid target id "${id}". Must match /^[a-z][a-z0-9-]*$/ (lowercase letters, digits, hyphens; start with a letter).`,
    );
  }
  if ((TARGET_IDS as readonly string[]).includes(id)) {
    throw new Error(`Target "${id}" already exists as a built-in target. Choose a different id.`);
  }

  // ── Build file map ─────────────────────────────────────────────────────────
  const files: Array<{ rel: string; content: string }> = [
    { rel: `src/targets/${id}/constants.ts`, content: TEMPLATE_CONSTANTS(v) },
    { rel: `src/targets/${id}/index.ts`, content: TEMPLATE_INDEX(v) },
    { rel: `src/targets/${id}/generator.ts`, content: TEMPLATE_GENERATOR(v) },
    { rel: `src/targets/${id}/importer.ts`, content: TEMPLATE_IMPORTER(v) },
    { rel: `src/targets/${id}/linter.ts`, content: TEMPLATE_LINTER(v) },
    { rel: `src/targets/${id}/lint.ts`, content: TEMPLATE_LINT_HOOKS(v) },
    { rel: `src/core/reference/import-maps/${id}.ts`, content: TEMPLATE_IMPORT_MAP(v) },
    {
      rel: `tests/unit/targets/${id}/generator.test.ts`,
      content: TEMPLATE_GENERATOR_TEST(v),
    },
    {
      rel: `tests/unit/targets/${id}/importer.test.ts`,
      content: TEMPLATE_IMPORTER_TEST(v),
    },
    {
      rel: `tests/e2e/fixtures/${id}-project/AGENTS.md`,
      content: TEMPLATE_FIXTURE_ROOT_MD(v),
    },
  ];

  // ── Write files ────────────────────────────────────────────────────────────
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const abs = join(projectRoot, file.rel);
    if (!force && (await exists(abs))) {
      skipped.push(abs);
      continue;
    }
    await writeFileAtomic(abs, file.content);
    written.push(abs);
  }

  // ── Post-steps ────────────────────────────────────────────────────────────
  const postSteps = [
    `1. Add '${id}' to TARGET_IDS in src/targets/catalog/target-ids.ts`,
    `2. Add descriptor import + entry to src/targets/catalog/builtin-targets.ts`,
    `3. Add export to src/core/reference/import-maps/index.ts`,
    `4. Run: pnpm typecheck && pnpm test -- tests/unit/targets/${id}`,
    `5. Run: pnpm schemas:generate && pnpm matrix:generate`,
    `6. Fill in TODO(agentsmesh-scaffold) markers in src/targets/${id}/`,
  ];

  return { written, skipped, postSteps };
}
