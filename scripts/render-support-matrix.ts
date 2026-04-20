/**
 * Renders README + website support matrices from SUPPORT_MATRIX / SUPPORT_MATRIX_GLOBAL.
 * Usage: `pnpm matrix:generate` | `pnpm matrix:verify` (non-zero if docs drift from catalog).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupportLevel } from '../src/core/result-types.js';
import { SUPPORT_MATRIX, SUPPORT_MATRIX_GLOBAL } from '../src/core/matrix/data.js';
import { TARGET_IDS } from '../src/targets/catalog/target-ids.js';
import type { TargetCapabilityValue } from '../src/targets/catalog/capabilities.js';

const ROOT =
  process.env.AGENTSMESH_MATRIX_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGET_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  copilot: 'Copilot',
  continue: 'Continue',
  junie: 'Junie',
  kiro: 'Kiro',
  'gemini-cli': 'Gemini CLI',
  cline: 'Cline',
  'codex-cli': 'Codex CLI',
  windsurf: 'Windsurf',
  antigravity: 'Antigravity',
  'roo-code': 'Roo Code',
};

const FEATURE_ROWS: [string, keyof typeof SUPPORT_MATRIX][] = [
  ['Rules', 'rules'],
  ['Commands', 'commands'],
  ['Agents', 'agents'],
  ['Skills', 'skills'],
  ['MCP Servers', 'mcp'],
  ['Hooks', 'hooks'],
  ['Ignore', 'ignore'],
  ['Permissions', 'permissions'],
];

const LEVEL_LABELS: Record<SupportLevel, string> = {
  native: 'Native',
  embedded: 'Embedded',
  partial: 'Partial',
  none: '—',
};

function cellLabel(c: TargetCapabilityValue): string {
  const base = LEVEL_LABELS[c.level];
  if (c.flavor && c.flavor !== 'standard') {
    return `${base} (${c.flavor})`;
  }
  return base;
}

function buildMarkdownTable(matrix: typeof SUPPORT_MATRIX): string {
  const headers = ['Feature', ...TARGET_IDS.map((id) => TARGET_LABELS[id])];
  const header = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map((h) => (h === 'Feature' ? '---' : ':-----------:')).join('|')}|`;
  const lines = FEATURE_ROWS.map(([label, key]) => {
    const cells = [label, ...TARGET_IDS.map((t) => cellLabel(matrix[key][t]))];
    return `| ${cells.join(' | ')} |`;
  });
  return [header, sep, ...lines].join('\n');
}

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

function renderReadme(): void {
  const path = join(ROOT, 'README.md');
  let text = readFileSync(path, 'utf-8');
  const projBlock = buildMarkdownTable(SUPPORT_MATRIX);
  text = replaceBetweenMarkers(
    text,
    '<!-- agentsmesh:support-matrix:project -->',
    '<!-- /agentsmesh:support-matrix:project -->',
    projBlock,
  );
  const globBlock = buildMarkdownTable(SUPPORT_MATRIX_GLOBAL);
  text = replaceBetweenMarkers(
    text,
    '<!-- agentsmesh:support-matrix:global -->',
    '<!-- /agentsmesh:support-matrix:global -->',
    globBlock,
  );
  writeFileSync(path, text);
}

function renderWebsiteMdx(): void {
  const path = join(ROOT, 'website/src/content/docs/reference/supported-tools.mdx');
  let text = readFileSync(path, 'utf-8');
  const projBlock = buildMarkdownTable(SUPPORT_MATRIX);
  text = replaceBetweenMarkers(
    text,
    '<!-- agentsmesh:support-matrix:project -->',
    '<!-- /agentsmesh:support-matrix:project -->',
    projBlock,
  );
  const globBlock = buildMarkdownTable(SUPPORT_MATRIX_GLOBAL);
  text = replaceBetweenMarkers(
    text,
    '<!-- agentsmesh:support-matrix:global -->',
    '<!-- /agentsmesh:support-matrix:global -->',
    globBlock,
  );
  writeFileSync(path, text);
}

function expectedDocument(source: string, globalMatrix: typeof SUPPORT_MATRIX_GLOBAL): string {
  let t = replaceBetweenMarkers(
    source,
    '<!-- agentsmesh:support-matrix:project -->',
    '<!-- /agentsmesh:support-matrix:project -->',
    buildMarkdownTable(SUPPORT_MATRIX),
  );
  t = replaceBetweenMarkers(
    t,
    '<!-- agentsmesh:support-matrix:global -->',
    '<!-- /agentsmesh:support-matrix:global -->',
    buildMarkdownTable(globalMatrix),
  );
  return t;
}

const verify = process.argv.includes('--verify');

if (verify) {
  const readmePath = join(ROOT, 'README.md');
  const mdxPath = join(ROOT, 'website/src/content/docs/reference/supported-tools.mdx');
  const readme = readFileSync(readmePath, 'utf-8');
  const mdx = readFileSync(mdxPath, 'utf-8');
  if (
    readme !== expectedDocument(readme, SUPPORT_MATRIX_GLOBAL) ||
    mdx !== expectedDocument(mdx, SUPPORT_MATRIX_GLOBAL)
  ) {
    process.stderr.write(
      'matrix:verify failed: README or supported-tools.mdx does not match SUPPORT_MATRIX.\nRun pnpm matrix:generate\n',
    );
    process.exit(1);
  }
  process.stdout.write('matrix:verify OK\n');
} else {
  renderReadme();
  renderWebsiteMdx();
}
