import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importCodexRules } from '../../../../src/targets/codex-cli/importer-rules.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot: string;
const noopNorm = (c: string): string => c;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-rem-codex-rules-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('importCodexRules — extra branches', () => {
  it('imports global AGENTS.md when scope=global (uses globalAgentsPath fallback)', async () => {
    writeFile('.codex/AGENTS.md', '# global codex agents body');
    const out: ImportResult[] = [];
    await importCodexRules(projectRoot, out, noopNorm, noopNorm, 'global');
    expect(out.some((r) => r.toPath.endsWith('_root.md'))).toBe(true);
  });

  it('imports global AGENTS.override.md when scope=global with override (highest priority)', async () => {
    writeFile('.codex/AGENTS.override.md', '# override\n');
    writeFile('.codex/AGENTS.md', 'should-be-shadowed');
    const out: ImportResult[] = [];
    await importCodexRules(projectRoot, out, noopNorm, noopNorm, 'global');
    const rootResult = out.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootResult).toBeDefined();
    if (rootResult) {
      // Read the destination file to verify content came from override
      const content = await readFile(join(projectRoot, rootResult.toPath), 'utf-8');
      expect(content).toContain('override');
    }
  });

  it('imports project AGENTS.md when scope=project (line 156–163 mirror & non-root)', async () => {
    writeFile('AGENTS.md', '# project agents');
    writeFile('docs/AGENTS.md', '# scoped doc agents');
    writeFile('docs/AGENTS.override.md', '# scoped override');
    const out: ImportResult[] = [];
    await importCodexRules(projectRoot, out, noopNorm, noopNorm, 'project');
    expect(out.some((r) => r.toPath.endsWith('_root.md'))).toBe(true);
  });

  it('skips scoped AGENTS.md at project root (line 115/116 conditions)', async () => {
    writeFile('AGENTS.md', '# project agents');
    const out: ImportResult[] = [];
    await importCodexRules(projectRoot, out, noopNorm, noopNorm, 'project');
    // Only one _root rule, no scoped rule for the root AGENTS.md
    const scoped = out.filter((r) => r.feature === 'rules' && !r.toPath.endsWith('_root.md'));
    expect(scoped.every((r) => !r.toPath.endsWith('-.md'))).toBe(true);
  });

  it('handles codex.md alone as fallback when no AGENTS.md (line 56 codexPath)', async () => {
    writeFile('codex.md', '# legacy codex');
    const out: ImportResult[] = [];
    await importCodexRules(projectRoot, out, noopNorm, noopNorm, 'project');
    expect(out.some((r) => r.toPath.endsWith('_root.md'))).toBe(true);
  });
});
