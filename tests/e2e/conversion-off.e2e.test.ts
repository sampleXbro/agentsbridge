import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from './helpers/canonical.js';
import { cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

describe('conversion-off e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('codex-cli with commands-to-skills disabled emits no am-command skills', async () => {
    dir = createCanonicalProject(`version: 1
targets: [codex-cli]
features: [rules, commands, skills]
conversions:
  commands_to_skills:
    codex-cli: false
`);

    const result = await runCli('generate --targets codex-cli', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(existsSync(join(dir, '.agents', 'skills', 'am-command-review'))).toBe(false);
  });

  it('cline with agents-to-skills disabled emits no am-agent projected skills', async () => {
    dir = createCanonicalProject(`version: 1
targets: [cline]
features: [rules, agents, skills]
conversions:
  agents_to_skills:
    cline: false
`);

    const result = await runCli('generate --targets cline', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(existsSync(join(dir, '.cline', 'skills', 'am-agent-code-reviewer'))).toBe(false);
    expect(existsSync(join(dir, '.cline', 'skills', 'am-agent-researcher'))).toBe(false);
  });

  it('windsurf with agents-to-skills disabled emits no am-agent projected skills', async () => {
    dir = createCanonicalProject(`version: 1
targets: [windsurf]
features: [rules, agents, skills]
conversions:
  agents_to_skills:
    windsurf: false
`);

    const result = await runCli('generate --targets windsurf', dir);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(existsSync(join(dir, '.windsurf', 'skills', 'am-agent-code-reviewer'))).toBe(false);
    expect(existsSync(join(dir, '.windsurf', 'skills', 'am-agent-researcher'))).toBe(false);
  });
});
