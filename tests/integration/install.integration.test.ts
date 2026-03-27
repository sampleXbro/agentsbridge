/**
 * agentsmesh install — local dry-run against a skill pack fixture.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { logger } from '../../src/utils/output/logger.js';

const ROOT = join(tmpdir(), 'am-install-integration');

describe('install (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', 'skills', 'demo'), { recursive: true });
    writeFileSync(
      join(ROOT, 'upstream', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo skill for install test\n---\n# Demo\n',
    );
    mkdirSync(join(ROOT, 'project', '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(ROOT, 'project', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, skills]
extends: []
`,
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('dry-run does not modify agentsmesh.yaml', async () => {
    const project = join(ROOT, 'project');
    const yamlPath = join(project, 'agentsmesh.yaml');
    const snapshot = readFileSync(yamlPath, 'utf8');

    await runInstall({ 'dry-run': true }, [join(ROOT, 'upstream', 'skills', 'demo')], project);

    expect(readFileSync(yamlPath, 'utf8')).toBe(snapshot);
  });

  it('dry-run from single rule file path emits pick.rules and rules feature', async () => {
    const project = join(ROOT, 'project');
    const rules = join(ROOT, 'upstream', 'rules');
    mkdirSync(rules, { recursive: true });
    writeFileSync(join(rules, 'solo.md'), '---\ndescription: One rule\n---\n# Solo\n');

    const spy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    await runInstall({ 'dry-run': true, extends: true }, [join(rules, 'solo.md')], project);
    const msg = spy.mock.calls.map((c) => String(c[0])).find((m) => m.includes('[dry-run]'));
    spy.mockRestore();
    expect(msg).toBeDefined();
    const entry = JSON.parse(msg!.slice(msg!.indexOf('{'))) as {
      features: string[];
      pick?: { rules?: string[] };
    };
    expect(entry.features).toContain('rules');
    expect(entry.pick).toEqual({ rules: ['solo'] });
  });

  it('dry-run with --target gemini-cli and .gemini/commands emits target, path, and command pick', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream-gemini');
    mkdirSync(join(upstream, '.gemini', 'commands'), { recursive: true });
    writeFileSync(
      join(upstream, '.gemini', 'commands', 'demo.toml'),
      'description = "Demo"\nprompt = "Run demo"\n',
    );

    const spy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    await runInstall(
      {
        'dry-run': true,
        force: true,
        extends: true,
        target: 'gemini-cli',
        path: '.gemini/commands',
      },
      [upstream],
      project,
    );
    const msg = spy.mock.calls.map((c) => String(c[0])).find((m) => m.includes('[dry-run]'));
    spy.mockRestore();
    expect(msg).toBeDefined();
    const entry = JSON.parse(msg!.slice(msg!.indexOf('{'))) as {
      features: string[];
      target?: string;
      path?: string;
      pick?: { commands?: string[] };
    };
    expect(entry.target).toBe('gemini-cli');
    expect(entry.path).toBe('.gemini/commands');
    expect(entry.pick?.commands).toEqual(['demo']);
    expect(entry.features).toContain('commands');
  });
});
