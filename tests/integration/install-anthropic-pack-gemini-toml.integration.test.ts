/**
 * Anthropic skill-pack install with a `.gemini/commands/*.toml` directory.
 *
 * Gemini CLI's native command format is TOML, not Markdown. The skill-pack
 * aggregator must delegate the `.gemini/commands/` read to the gemini-cli
 * target's command importer (which handles `.toml`) instead of using the
 * canonical Markdown-only parser. Failure mode before the refactor: every
 * `.toml` file silently dropped with an "unrecognized resource formats"
 * warning; the canonical command set is short by N entries.
 *
 * Regression for `addyosmani/agent-skills` and any other skill pack that
 * ships Gemini-native slash commands alongside Claude-style ones.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { logger } from '../../src/utils/output/logger.js';

const ROOT = join(tmpdir(), 'am-install-anthropic-pack-gemini-toml');

function buildUpstreamWithToml(upstream: string): void {
  mkdirSync(join(upstream, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(upstream, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: demo skill\n---\n# demo\n',
  );

  // Gemini slash commands are TOML. The aggregator must route this dir
  // through the gemini-cli command importer (extensions: .md + .toml).
  mkdirSync(join(upstream, '.gemini', 'commands'), { recursive: true });
  writeFileSync(
    join(upstream, '.gemini', 'commands', 'say-hi.toml'),
    'description = "Say hi"\nprompt = """Hi from Gemini"""\n',
  );
  writeFileSync(
    join(upstream, '.gemini', 'commands', 'say-bye.toml'),
    'description = "Say bye"\nprompt = """Bye from Gemini"""\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills, commands]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  buildUpstreamWithToml(join(ROOT, 'upstream'));
  buildProject(join(ROOT, 'project'));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('anthropic skill-pack with .gemini/commands/*.toml', () => {
  it('suppresses the "skipped N .toml commands" warning when the gemini-cli mapper handles them', async () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(logger, 'warn').mockImplementation((m: string) => {
      warnings.push(m);
    });

    try {
      await runInstall(
        { force: true, name: 'gemini-toml-pack' },
        [join(ROOT, 'upstream')],
        join(ROOT, 'project'),
      );
    } finally {
      spy.mockRestore();
    }

    // The legacy "Skipped N commands file(s) ... format: .toml" warning must
    // not fire — the gemini-cli mapper actually parses those files.
    expect(warnings.filter((w) => /\.toml/i.test(w) && /skipped/i.test(w))).toEqual([]);
  });

  it('parses TOML slash commands into canonical .md via the gemini-cli importer mapper', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');

    await runInstall({ force: true, name: 'gemini-toml-pack' }, [upstream], project);

    const commandsDir = join(project, '.agentsmesh', 'packs', 'gemini-toml-pack', 'commands');

    // Both .toml files must materialize as canonical .md commands.
    expect(existsSync(join(commandsDir, 'say-hi.md'))).toBe(true);
    expect(existsSync(join(commandsDir, 'say-bye.md'))).toBe(true);

    const sayHi = readFileSync(join(commandsDir, 'say-hi.md'), 'utf-8');
    expect(sayHi).toContain('description: Say hi');
    expect(sayHi).toContain('Hi from Gemini');

    const sayBye = readFileSync(join(commandsDir, 'say-bye.md'), 'utf-8');
    expect(sayBye).toContain('description: Say bye');
    expect(sayBye).toContain('Bye from Gemini');
  });
});
