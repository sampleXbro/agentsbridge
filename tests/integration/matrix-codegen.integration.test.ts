/**
 * P1-4: Matrix codegen integration test.
 * Renders the matrix into a fixture README + MDX (markers only) and asserts the
 * output structure is well-formed and reflects the live catalog capabilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORT_MATRIX, SUPPORT_MATRIX_GLOBAL } from '../../src/core/matrix/data.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT = join(REPO_ROOT, 'scripts', 'render-support-matrix.ts');
const TSX = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const EMPTY_README = `# Fixture

<!-- agentsmesh:support-matrix:project -->
<!-- /agentsmesh:support-matrix:project -->

<!-- agentsmesh:support-matrix:global -->
<!-- /agentsmesh:support-matrix:global -->
`;

const EMPTY_MDX = `---
title: Fixture
---
{/* agentsmesh:support-matrix:project:start */}
{/* agentsmesh:support-matrix:project:end */}

{/* agentsmesh:support-matrix:global:start */}
{/* agentsmesh:support-matrix:global:end */}
`;

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'am-matrix-codegen-'));
  writeFileSync(join(tmpRoot, 'README.md'), EMPTY_README);
  mkdirSync(join(tmpRoot, 'website', 'src', 'content', 'docs', 'reference'), { recursive: true });
  writeFileSync(
    join(tmpRoot, 'website', 'src', 'content', 'docs', 'reference', 'supported-tools.mdx'),
    EMPTY_MDX,
  );
});

afterEach(() => rmSync(tmpRoot, { recursive: true, force: true }));

function runRenderer(
  root: string,
  args: string[] = [],
): { status: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync(TSX, [SCRIPT, ...args], {
      env: { ...process.env, AGENTSMESH_MATRIX_ROOT: root },
      encoding: 'utf-8',
    });
    return { status: 0, stderr: '', stdout };
  } catch (e) {
    const err = e as { status?: number; stderr?: Buffer | string; stdout?: Buffer | string };
    return {
      status: err.status ?? 1,
      stderr: err.stderr?.toString() ?? '',
      stdout: err.stdout?.toString() ?? '',
    };
  }
}

describe('matrix codegen', () => {
  it('renders project + global tables into README markers with a row per feature', () => {
    const result = runRenderer(tmpRoot);
    expect(result.status).toBe(0);
    const readme = readFileSync(join(tmpRoot, 'README.md'), 'utf-8');
    const proj = extractBlock(readme, 'project');
    const glob = extractBlock(readme, 'global');
    for (const block of [proj, glob]) {
      expect(block).toContain('| Feature |');
      expect(block).toContain('| Rules |');
      expect(block).toContain('| Commands |');
      expect(block).toContain('| Agents |');
      expect(block).toContain('| Skills |');
      expect(block).toContain('| MCP Servers |');
      expect(block).toContain('| Hooks |');
      expect(block).toContain('| Ignore |');
      expect(block).toContain('| Permissions |');
    }
  });

  it('renders the same tables into the website MDX markers', () => {
    runRenderer(tmpRoot);
    const mdx = readFileSync(
      join(tmpRoot, 'website', 'src', 'content', 'docs', 'reference', 'supported-tools.mdx'),
      'utf-8',
    );
    const readme = readFileSync(join(tmpRoot, 'README.md'), 'utf-8');
    expect(extractBlock(mdx, 'project')).toBe(extractBlock(readme, 'project'));
    expect(extractBlock(mdx, 'global')).toBe(extractBlock(readme, 'global'));
  });

  it('reflects live catalog capabilities in rendered cells', () => {
    runRenderer(tmpRoot);
    const readme = readFileSync(join(tmpRoot, 'README.md'), 'utf-8');
    const proj = extractBlock(readme, 'project');
    const glob = extractBlock(readme, 'global');
    // claude-code rules are always native in both scopes.
    expect(SUPPORT_MATRIX.rules['claude-code']?.level).toBe('native');
    expect(SUPPORT_MATRIX_GLOBAL.rules['claude-code']?.level).toBe('native');
    expect(proj).toMatch(/\| Rules \|\s*Native/);
    expect(glob).toMatch(/\| Rules \|\s*Native/);
  });

  it('verify mode exits 0 on freshly rendered documents', () => {
    expect(runRenderer(tmpRoot).status).toBe(0);
    const verify = runRenderer(tmpRoot, ['--verify']);
    expect(verify.status).toBe(0);
    expect(verify.stdout).toContain('matrix:verify OK');
  });
});

function extractBlock(text: string, kind: 'project' | 'global'): string {
  const htmlStart = `<!-- agentsmesh:support-matrix:${kind} -->`;
  const htmlEnd = `<!-- /agentsmesh:support-matrix:${kind} -->`;
  const mdxStart = `{/* agentsmesh:support-matrix:${kind}:start */}`;
  const mdxEnd = `{/* agentsmesh:support-matrix:${kind}:end */}`;
  const start = text.includes(htmlStart) ? htmlStart : mdxStart;
  const end = text.includes(htmlEnd) ? htmlEnd : mdxEnd;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`markers missing for ${kind}`);
  return text.slice(a + start.length, b).trim();
}
