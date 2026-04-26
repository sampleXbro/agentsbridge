/**
 * P1-4: Matrix drift guard.
 * Verifies that `matrix:verify` fails with non-zero exit when documentation
 * drifts from the live target catalog.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveNodeBin } from '../helpers/node-bin.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT = join(REPO_ROOT, 'scripts', 'render-support-matrix.ts');
const TSX = resolveNodeBin(REPO_ROOT, 'tsx');
const MDX_REL = join('website', 'src', 'content', 'docs', 'reference', 'supported-tools.mdx');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'am-matrix-drift-'));
  copyFileSync(join(REPO_ROOT, 'README.md'), join(tmpRoot, 'README.md'));
  mkdirSync(join(tmpRoot, 'website', 'src', 'content', 'docs', 'reference'), { recursive: true });
  copyFileSync(join(REPO_ROOT, MDX_REL), join(tmpRoot, MDX_REL));
});

afterEach(() => rmSync(tmpRoot, { recursive: true, force: true }));

function runVerify(root: string): { status: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync(TSX, [SCRIPT, '--verify'], {
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

function injectDrift(filePath: string, marker: string): void {
  const content = readFileSync(filePath, 'utf-8');
  const isMdx = filePath.endsWith('.mdx');
  const start = isMdx
    ? `{/* agentsmesh:support-matrix:${marker}:start */}`
    : `<!-- agentsmesh:support-matrix:${marker} -->`;
  const end = isMdx
    ? `{/* agentsmesh:support-matrix:${marker}:end */}`
    : `<!-- /agentsmesh:support-matrix:${marker} -->`;
  const a = content.indexOf(start);
  const b = content.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`markers missing for ${marker} in ${filePath}`);
  const tampered =
    content.slice(0, a + start.length) +
    '\n| Feature | Fake Target |\n|---|:---:|\n| Rules | ABSOLUTELY-WRONG |\n' +
    content.slice(b);
  writeFileSync(filePath, tampered);
}

describe('matrix drift guard', () => {
  it('passes verify when README/MDX match the catalog', () => {
    const result = runVerify(tmpRoot);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('matrix:verify OK');
  });

  it('fails verify when README project block drifts', () => {
    injectDrift(join(tmpRoot, 'README.md'), 'project');
    const result = runVerify(tmpRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('matrix:verify failed');
  });

  it('fails verify when README global block drifts', () => {
    injectDrift(join(tmpRoot, 'README.md'), 'global');
    const result = runVerify(tmpRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('matrix:verify failed');
  });

  it('fails verify when website MDX drifts', () => {
    injectDrift(join(tmpRoot, MDX_REL), 'project');
    const result = runVerify(tmpRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('matrix:verify failed');
  });
});
