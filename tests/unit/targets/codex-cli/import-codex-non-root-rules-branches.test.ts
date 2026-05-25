/**
 * Branch coverage for importCodexNonRootRuleFiles: .md path, .rules path with
 * and without embedded canonical metadata, and the empty-file skip branches.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importCodexNonRootRuleFiles } from '../../../../src/targets/codex-cli/import-codex-non-root-rules.js';
import { CODEX_RULES_DIR } from '../../../../src/targets/codex-cli/constants.js';

let projectRoot: string;
let destDir: string;
const normalize = (content: string): string => content;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'codex-non-root-rules-'));
  destDir = join(projectRoot, '.agentsmesh/rules');
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importCodexNonRootRuleFiles — branch gaps', () => {
  it('returns [] when .codex/rules does not exist', async () => {
    const out = await importCodexNonRootRuleFiles(projectRoot, destDir, normalize);
    expect(out).toEqual([]);
  });

  it('processes .md files writing both root and non-root markdown', async () => {
    const rulesPath = join(projectRoot, CODEX_RULES_DIR);
    mkdirSync(rulesPath, { recursive: true });
    writeFileSync(join(rulesPath, 'a.md'), '---\nroot: true\ndescription: r\n---\nbody a\n');
    writeFileSync(join(rulesPath, 'b.md'), '# bare body, no frontmatter\n');

    const out = await importCodexNonRootRuleFiles(projectRoot, destDir, normalize);
    expect(out).toHaveLength(2);
    expect(existsSync(join(destDir, 'a.md'))).toBe(true);
    expect(existsSync(join(destDir, 'b.md'))).toBe(true);
  });

  it('skips empty .md files (content === null branch)', async () => {
    const rulesPath = join(projectRoot, CODEX_RULES_DIR);
    mkdirSync(rulesPath, { recursive: true });
    writeFileSync(join(rulesPath, 'empty.md'), '');
    const out = await importCodexNonRootRuleFiles(projectRoot, destDir, normalize);
    expect(out).toEqual([]);
  });

  it('handles .rules files without embedded metadata (codex_emit fallback)', async () => {
    const rulesPath = join(projectRoot, CODEX_RULES_DIR);
    mkdirSync(rulesPath, { recursive: true });
    writeFileSync(join(rulesPath, 'flow.rules'), 'arbitrary starlark content\n');

    const out = await importCodexNonRootRuleFiles(projectRoot, destDir, normalize);
    expect(out).toHaveLength(1);
    expect(out[0].toPath).toBe('.agentsmesh/rules/flow.md');
    const written = readFileSync(join(destDir, 'flow.md'), 'utf-8');
    expect(written).toContain('codex_emit: execution');
  });

  it('skips empty .rules files', async () => {
    const rulesPath = join(projectRoot, CODEX_RULES_DIR);
    mkdirSync(rulesPath, { recursive: true });
    writeFileSync(join(rulesPath, 'empty.rules'), '');
    const out = await importCodexNonRootRuleFiles(projectRoot, destDir, normalize);
    expect(out).toEqual([]);
    expect(existsSync(join(destDir, 'empty.md'))).toBe(false);
  });
});
