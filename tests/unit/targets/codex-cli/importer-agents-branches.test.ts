/**
 * Branch coverage tests for codex-cli/importer-agents.ts.
 * Targets ternary fallbacks for missing/typed-incorrectly TOML fields and
 * the `Array.isArray(parsed.mcp_servers)` filter at line 38-40.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImportResult } from '../../../../src/core/types.js';
import { importCodexAgentsFromToml } from '../../../../src/targets/codex-cli/importer-agents.js';
import { CODEX_AGENTS_DIR } from '../../../../src/targets/codex-cli/constants.js';
import { readFileSync } from 'node:fs';

const identityNormalize = (content: string): string => content;

describe('importCodexAgentsFromToml — branch coverage', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('returns silently when .codex/agents directory does not exist', async () => {
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toEqual([]);
  });

  it('skips empty TOML files (readFileSafe returning falsy/empty content)', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'empty.toml'), '');
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toEqual([]);
  });

  it('falls back to file basename when name field is absent or non-string', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    // No name field, plus integer description and missing other optional fields → all
    // ternaries take the fallback branch.
    writeFileSync(
      join(agentsDir, 'fallback.toml'),
      ['description = 42', 'developer_instructions = 17'].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toHaveLength(1);
    expect(results[0]!.toPath).toBe('.agentsmesh/agents/fallback.md');
    const content = readFileSync(join(projectRoot, '.agentsmesh/agents/fallback.md'), 'utf-8');
    expect(content).toContain('name: fallback');
    // description was non-string → coerced to '' and omitted from frontmatter
    expect(content).not.toContain('description: 42');
  });

  it('maps sandbox_mode "workspace-write" to "allow"', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'writer.toml'),
      [
        'name = "writer"',
        'description = "Can write workspace"',
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """',
        'Body.',
        '"""',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toHaveLength(1);
    const content = readFileSync(join(projectRoot, '.agentsmesh/agents/writer.md'), 'utf-8');
    expect(content).toContain('permissionMode: allow');
  });

  it('uses empty permission mode for unknown sandbox value', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'mystery.toml'),
      [
        'name = "mystery"',
        'description = "Mystery sandbox"',
        'sandbox_mode = "danger-zone"',
        'developer_instructions = """',
        'Body.',
        '"""',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toHaveLength(1);
    const content = readFileSync(join(projectRoot, '.agentsmesh/agents/mystery.md'), 'utf-8');
    // No permissionMode line because the empty string is filtered out by serializer.
    expect(content).not.toMatch(/permissionMode:\s*danger-zone/);
  });

  it('keeps mcp_servers list and filters non-string entries', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'with-mcp.toml'),
      [
        'name = "with-mcp"',
        'description = "Uses MCP"',
        'mcp_servers = ["alpha", "beta"]',
        'developer_instructions = """',
        'Body.',
        '"""',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toHaveLength(1);
    const content = readFileSync(join(projectRoot, '.agentsmesh/agents/with-mcp.md'), 'utf-8');
    expect(content).toContain('alpha');
    expect(content).toContain('beta');
  });

  it('treats non-array mcp_servers as empty list', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, 'bad-mcp.toml'),
      [
        'name = "bad-mcp"',
        'description = "Bad MCP"',
        'mcp_servers = "not-an-array"',
        'developer_instructions = """',
        'Body.',
        '"""',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toHaveLength(1);
    const content = readFileSync(join(projectRoot, '.agentsmesh/agents/bad-mcp.md'), 'utf-8');
    expect(content).not.toContain('not-an-array');
  });

  it('skips non-toml files in the agents directory', async () => {
    const agentsDir = join(projectRoot, CODEX_AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'README.md'), '# not a toml');
    const results: ImportResult[] = [];
    await importCodexAgentsFromToml(projectRoot, results, identityNormalize);
    expect(results).toEqual([]);
  });
});
