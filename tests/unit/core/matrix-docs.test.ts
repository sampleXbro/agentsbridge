import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORT_MATRIX, SUPPORT_MATRIX_GLOBAL } from '../../../src/core/matrix/data.js';
import { TARGET_IDS } from '../../../src/targets/catalog/target-ids.js';
import type { TargetCapabilityValue } from '../../../src/targets/catalog/capabilities.js';

const ROOT = process.cwd();
const FEATURES = [
  ['Rules', 'rules'],
  ['Additional Rules', 'additionalRules'],
  ['Commands', 'commands'],
  ['Agents', 'agents'],
  ['Skills', 'skills'],
  ['MCP Servers', 'mcp'],
  ['Hooks', 'hooks'],
  ['Ignore', 'ignore'],
  ['Permissions', 'permissions'],
] as const;

const TARGET_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  copilot: 'Copilot',
  continue: 'Continue',
  goose: 'Goose',
  junie: 'Junie',
  kiro: 'Kiro',
  'gemini-cli': 'Gemini CLI',
  cline: 'Cline',
  'codex-cli': 'Codex CLI',
  windsurf: 'Windsurf',
  antigravity: 'Antigravity',
  'roo-code': 'Roo Code',
  'kilo-code': 'Kilo Code',
  opencode: 'OpenCode',
};

const LEVEL_LABELS = {
  native: 'Native',
  embedded: 'Embedded',
  partial: 'Partial',
  none: '—',
} as const;

function parseFeatureMatrix(
  markdown: string,
  afterHeading?: string,
): Record<string, Record<string, string>> {
  let body = markdown;
  if (afterHeading !== undefined) {
    const h = body.indexOf(afterHeading);
    expect(h).toBeGreaterThanOrEqual(0);
    body = body.slice(h);
  }
  const lines = body.split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith('| Feature '));
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  const headers = splitTableRow(lines[headerIndex]!);
  expect(headers).toEqual(['Feature', ...TARGET_IDS.map((id) => TARGET_LABELS[id])]);

  const rows: Record<string, Record<string, string>> = {};
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith('|')) break;
    const cells = splitTableRow(line);
    const feature = cells[0]!;
    rows[feature] = Object.fromEntries(headers.slice(1).map((target, i) => [target, cells[i + 1]]));
  }
  return rows;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim().replace(/--/g, '—'));
}

function formatMatrixCell(cell: TargetCapabilityValue): string {
  const base = LEVEL_LABELS[cell.level];
  if (cell.flavor && cell.flavor !== 'standard') {
    return `${base} (${cell.flavor})`;
  }
  return base;
}

function expectedRows(
  matrix: typeof SUPPORT_MATRIX = SUPPORT_MATRIX,
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    FEATURES.map(([label, feature]) => [
      label,
      Object.fromEntries(
        TARGET_IDS.map((target) => [
          TARGET_LABELS[target],
          formatMatrixCell(matrix[feature][target]),
        ]),
      ),
    ]),
  );
}

describe('compatibility matrix docs', () => {
  it.each([
    ['README', 'README.md'],
    ['website supported-tools page', 'website/src/content/docs/reference/supported-tools.mdx'],
  ])('%s project feature matrix matches target capabilities', (_name, relativePath) => {
    const markdown = readFileSync(join(ROOT, relativePath), 'utf-8');
    const heading = relativePath === 'README.md' ? undefined : '## Feature matrix (project scope)';
    expect(parseFeatureMatrix(markdown, heading)).toEqual(expectedRows(SUPPORT_MATRIX));
  });

  it.each([
    ['README', 'README.md'],
    ['website supported-tools page', 'website/src/content/docs/reference/supported-tools.mdx'],
  ])('%s global feature matrix matches globalSupport / catalog', (_name, relativePath) => {
    const markdown = readFileSync(join(ROOT, relativePath), 'utf-8');
    const heading =
      relativePath === 'README.md'
        ? '### Global scope (`agentsmesh generate --global`)'
        : '## Feature matrix (global scope)';
    expect(parseFeatureMatrix(markdown, heading)).toEqual(expectedRows(SUPPORT_MATRIX_GLOBAL));
  });

  it('documents Antigravity global workflows in the authoritative supported-tools page', () => {
    const supportedTools = readFileSync(
      join(ROOT, 'website/src/content/docs/reference/supported-tools.mdx'),
      'utf-8',
    );

    expect(supportedTools).toContain('~/.gemini/antigravity/workflows/');
    expect(supportedTools).not.toContain('commands/workflows are not emitted');
    expect(supportedTools).not.toContain('Workflows/commands are not emitted');
  });

  it('keeps the website global-mode table in canonical target order', () => {
    const supportedTools = readFileSync(
      join(ROOT, 'website/src/content/docs/reference/supported-tools.mdx'),
      'utf-8',
    );
    const lines = supportedTools.split('\n');
    const headerIndex = lines.findIndex((line) => line.startsWith('| Target '));
    expect(headerIndex).toBeGreaterThanOrEqual(0);

    const targets: string[] = [];
    for (const line of lines.slice(headerIndex + 2)) {
      if (!line.startsWith('|')) break;
      targets.push(splitTableRow(line)[0]!);
    }

    expect(targets).toEqual(TARGET_IDS.map((id) => TARGET_LABELS[id]));
  });

  it('keeps the CLI matrix sample on the current symbol-based format', () => {
    const cliDocs = readFileSync(join(ROOT, 'website/src/content/docs/cli/matrix.mdx'), 'utf-8');

    for (const target of ['antigravity', 'roo-code']) {
      expect(cliDocs).toContain(target);
    }
    expect(cliDocs).toContain('Legend: ✓ = native  ◆ = embedded  ◐ = partial  – = not supported');
    expect(cliDocs).toContain('additional rules');
    expect(cliDocs).toContain('metadata for round-trip import');
    expect(cliDocs).not.toContain('| `native` |');
  });
});
