/**
 * Renders README + website support matrices from SUPPORT_MATRIX / SUPPORT_MATRIX_GLOBAL.
 * Usage: `pnpm matrix:generate` | `pnpm matrix:verify` (non-zero if docs drift from catalog).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORT_MATRIX, SUPPORT_MATRIX_GLOBAL } from '../src/core/matrix/data.js';
import {
  buildImportTargetsTable,
  buildMarkdownTable,
  buildToolDetails,
  buildToolList,
} from './support-matrix-blocks.js';

const ROOT =
  process.env.AGENTSMESH_MATRIX_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');

const README_MARKERS = {
  project: {
    start: '<!-- agentsmesh:support-matrix:project -->',
    end: '<!-- /agentsmesh:support-matrix:project -->',
  },
  global: {
    start: '<!-- agentsmesh:support-matrix:global -->',
    end: '<!-- /agentsmesh:support-matrix:global -->',
  },
  importTargets: {
    start: '<!-- agentsmesh:import-targets -->',
    end: '<!-- /agentsmesh:import-targets -->',
  },
  toolList: {
    start: '<!-- agentsmesh:tool-list -->',
    end: '<!-- /agentsmesh:tool-list -->',
  },
} as const;

const MDX_MARKERS = {
  project: {
    start: '{/* agentsmesh:support-matrix:project:start */}',
    end: '{/* agentsmesh:support-matrix:project:end */}',
  },
  global: {
    start: '{/* agentsmesh:support-matrix:global:start */}',
    end: '{/* agentsmesh:support-matrix:global:end */}',
  },
  importTargets: {
    start: '{/* agentsmesh:import-targets:start */}',
    end: '{/* agentsmesh:import-targets:end */}',
  },
  toolList: {
    start: '{/* agentsmesh:tool-list:start */}',
    end: '{/* agentsmesh:tool-list:end */}',
  },
  toolDetails: {
    start: '{/* agentsmesh:tool-details:start */}',
    end: '{/* agentsmesh:tool-details:end */}',
  },
} as const;

function replaceBetweenMarkers(
  content: string,
  start: string,
  end: string,
  replacement: string,
): string {
  const a = content.indexOf(start);
  const b = content.indexOf(end);
  if (a < 0 || b < 0 || b <= a) {
    throw new Error(`Missing markers: ${start} / ${end}`);
  }
  return content.slice(0, a + start.length) + '\n' + replacement + '\n' + content.slice(b);
}

function maybeReplace(content: string, start: string, end: string, replacement: string): string {
  if (!content.includes(start) || !content.includes(end)) return content;
  return replaceBetweenMarkers(content, start, end, replacement);
}

type MarkerSet = typeof README_MARKERS | typeof MDX_MARKERS;

function applyAllBlocks(source: string, markers: MarkerSet): string {
  let t = replaceBetweenMarkers(
    source,
    markers.project.start,
    markers.project.end,
    buildMarkdownTable(SUPPORT_MATRIX),
  );
  t = replaceBetweenMarkers(
    t,
    markers.global.start,
    markers.global.end,
    buildMarkdownTable(SUPPORT_MATRIX_GLOBAL),
  );
  t = maybeReplace(
    t,
    markers.importTargets.start,
    markers.importTargets.end,
    buildImportTargetsTable(),
  );
  t = maybeReplace(t, markers.toolList.start, markers.toolList.end, buildToolList());
  return t;
}

function applyOptionalBlock(source: string, start: string, end: string, block: string): string {
  return maybeReplace(source, start, end, block);
}

function renderFile(path: string, transform: (text: string) => string, optional = false): void {
  if (optional && !existsSync(path)) return;
  const text = readFileSync(path, 'utf-8');
  writeFileSync(path, transform(text));
}

const PATHS = {
  readme: join(ROOT, 'README.md'),
  supported: join(ROOT, 'website/src/content/docs/reference/supported-tools.mdx'),
  importPage: join(ROOT, 'website/src/content/docs/cli/import.mdx'),
  homepage: join(ROOT, 'website/src/content/docs/index.mdx'),
} as const;

function renderAll(): void {
  renderFile(PATHS.readme, (t) => applyAllBlocks(t, README_MARKERS));
  renderFile(PATHS.supported, (t) => {
    let s = applyAllBlocks(t, MDX_MARKERS);
    s = applyOptionalBlock(
      s,
      MDX_MARKERS.toolDetails.start,
      MDX_MARKERS.toolDetails.end,
      buildToolDetails(),
    );
    return s;
  });
  renderFile(
    PATHS.importPage,
    (t) =>
      applyOptionalBlock(
        t,
        MDX_MARKERS.importTargets.start,
        MDX_MARKERS.importTargets.end,
        buildImportTargetsTable(),
      ),
    true,
  );
  renderFile(
    PATHS.homepage,
    (t) =>
      applyOptionalBlock(t, MDX_MARKERS.toolList.start, MDX_MARKERS.toolList.end, buildToolList()),
    true,
  );
}

function verifyAll(): boolean {
  const readme = readFileSync(PATHS.readme, 'utf-8');
  if (readme !== applyAllBlocks(readme, README_MARKERS)) return false;
  const supported = readFileSync(PATHS.supported, 'utf-8');
  const supportedExpected = applyOptionalBlock(
    applyAllBlocks(supported, MDX_MARKERS),
    MDX_MARKERS.toolDetails.start,
    MDX_MARKERS.toolDetails.end,
    buildToolDetails(),
  );
  if (supported !== supportedExpected) return false;
  if (existsSync(PATHS.importPage)) {
    const importMdx = readFileSync(PATHS.importPage, 'utf-8');
    const expected = applyOptionalBlock(
      importMdx,
      MDX_MARKERS.importTargets.start,
      MDX_MARKERS.importTargets.end,
      buildImportTargetsTable(),
    );
    if (importMdx !== expected) return false;
  }
  if (existsSync(PATHS.homepage)) {
    const homepage = readFileSync(PATHS.homepage, 'utf-8');
    const expected = applyOptionalBlock(
      homepage,
      MDX_MARKERS.toolList.start,
      MDX_MARKERS.toolList.end,
      buildToolList(),
    );
    if (homepage !== expected) return false;
  }
  return true;
}

if (process.argv.includes('--verify')) {
  if (!verifyAll()) {
    process.stderr.write(
      'matrix:verify failed: docs do not match catalog.\nRun pnpm matrix:generate\n',
    );
    process.exit(1);
  }
  process.stdout.write('matrix:verify OK\n');
} else {
  renderAll();
}
