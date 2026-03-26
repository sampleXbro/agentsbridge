/**
 * Integration test for agentsmesh init.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'ab-integration-init');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh init (integration)', () => {
  it('creates agentsmesh.yaml, .agentsmesh/, and agentsmesh.local.yaml', () => {
    execSync(`node ${CLI_PATH} init`, { cwd: TEST_DIR });
    const config = readFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'utf-8');
    expect(config).toContain('version: 1');
    expect(config).toContain('claude-code');

    const rootRule = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootRule).toContain('root: true');

    const local = readFileSync(join(TEST_DIR, 'agentsmesh.local.yaml'), 'utf-8');
    expect(local).toContain('targets');
    expect(local).toContain('overrides');
  });

  it('appends to .gitignore', () => {
    writeFileSync(join(TEST_DIR, '.gitignore'), 'node_modules\n');
    execSync(`node ${CLI_PATH} init`, { cwd: TEST_DIR });
    const gitignore = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('agentsmesh.local.yaml');
  });

  it('exits with error when already initialized', () => {
    writeFileSync(join(TEST_DIR, 'agentsmesh.yaml'), 'version: 1\n');
    expect(() => execSync(`node ${CLI_PATH} init`, { cwd: TEST_DIR })).toThrow();
  });

  it('init then generate produces .claude/CLAUDE.md', () => {
    execSync(`node ${CLI_PATH} init`, { cwd: TEST_DIR });
    execSync(`node ${CLI_PATH} generate`, { cwd: TEST_DIR });
    const claude = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('Project Rules');
    expect(claude).toContain('synced to all configured tools');
  });
});
