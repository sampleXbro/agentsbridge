/**
 * Flat root `commands/` dir with TOML (Gemini-CLI native format) installs
 * without any flags — the canonical/manual install paths must delegate to
 * each registered target's command importer mapper, the same way the
 * Anthropic skill-pack aggregator does.
 *
 * Regression for `JuliusBrussee/caveman` (root-level `commands/*.toml`).
 * Failure mode before this change: every `.toml` file dropped with the
 * "Skipped N commands file(s) … format: .toml" warning even though the
 * gemini-cli target descriptor ships a TOML-aware mapper.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import { logger } from '../../src/utils/output/logger.js';

const ROOT = join(tmpdir(), 'am-install-flat-commands-toml');

function buildUpstreamFlatToml(upstream: string): void {
  // Canonical-named root `commands/` dir holding Gemini-style TOML
  // commands — no `.gemini/` parent, no skill-pack marker, no .md.
  // This is the `JuliusBrussee/caveman` shape.
  mkdirSync(join(upstream, 'commands'), { recursive: true });
  writeFileSync(
    join(upstream, 'commands', 'say-hi.toml'),
    'description = "Say hi"\nprompt = """Hi from Gemini"""\n',
  );
  writeFileSync(
    join(upstream, 'commands', 'say-bye.toml'),
    'description = "Say bye"\nprompt = """Bye from Gemini"""\n',
  );
  // Sibling skills/ dir so the layout detector picks canonical (not picker).
  mkdirSync(join(upstream, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(upstream, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: demo skill\n---\n# demo\n',
  );
}

function buildProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, commands]\nextends: []\n',
  );
  writeFileSync(
    join(project, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n# Root\n',
  );
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  buildUpstreamFlatToml(join(ROOT, 'upstream'));
  buildProject(join(ROOT, 'project'));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('flat root commands/*.toml install with no flags', () => {
  it('suppresses the "skipped N .toml commands" warning when a target mapper handles them', async () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(logger, 'warn').mockImplementation((m: string) => {
      warnings.push(m);
    });

    try {
      await runInstall(
        { force: true, name: 'caveman-style-pack' },
        [join(ROOT, 'upstream')],
        join(ROOT, 'project'),
      );
    } finally {
      spy.mockRestore();
    }

    expect(warnings.filter((w) => /\.toml/i.test(w) && /skipped/i.test(w))).toEqual([]);
  });

  it('parses TOML slash commands into canonical .md via the gemini-cli importer mapper', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');

    await runInstall({ force: true, name: 'caveman-style-pack' }, [upstream], project);

    const commandsDir = join(project, '.agentsmesh', 'packs', 'caveman-style-pack', 'commands');
    expect(existsSync(join(commandsDir, 'say-hi.md'))).toBe(true);
    expect(existsSync(join(commandsDir, 'say-bye.md'))).toBe(true);

    const sayHi = readFileSync(join(commandsDir, 'say-hi.md'), 'utf-8');
    expect(sayHi).toContain('description: Say hi');
    expect(sayHi).toContain('Hi from Gemini');
  });
});
