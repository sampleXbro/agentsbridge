/**
 * E2E tests for agentsbridge matrix.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { createCanonicalProject } from './helpers/canonical.js';

describe('matrix', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('prints compatibility table including Continue when configured', async () => {
    dir = createCanonicalProject(`version: 1
targets:
  - claude-code
  - cursor
  - copilot
  - continue
  - junie
  - gemini-cli
  - cline
  - codex-cli
  - windsurf
features:
  - rules
  - commands
  - mcp
`);
    const r = await runCli('matrix', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(
      /claude-code|cursor|copilot|continue|junie|gemini|cline|codex|windsurf/i,
    );
  });

  it('--verbose shows per-file details', async () => {
    dir = createTestProject('canonical-full');
    const r = await runCli('matrix --verbose', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/rules|commands|_root|typescript/i);
  });

  it('shows disabled skill projections as unsupported', async () => {
    dir = createCanonicalProject(`version: 1
targets:
  - codex-cli
  - windsurf
features:
  - commands
  - agents
`);
    writeFileSync(
      join(dir, 'agentsbridge.local.yaml'),
      `conversions:
  commands_to_skills:
    codex-cli: false
  agents_to_skills:
    windsurf: false
`,
    );

    const codex = await runCli('matrix --targets codex-cli', dir);
    const windsurf = await runCli('matrix --targets windsurf', dir);

    expect(codex.exitCode).toBe(0);
    expect(windsurf.exitCode).toBe(0);
    expect(codex.stdout.split('\n').find((line) => line.includes('commands'))).toContain('–');
    expect(windsurf.stdout.split('\n').find((line) => line.includes('agents'))).toContain('–');
  });
});
