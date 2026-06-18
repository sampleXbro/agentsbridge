import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRules } from '../../../src/canonical/features/rules.js';
import { parseCommands } from '../../../src/canonical/features/commands.js';
import { parseAgents } from '../../../src/canonical/features/agents.js';

/**
 * A malicious pack (or local tree) can place a symlink inside rules/commands/
 * agents pointing at a host secret (e.g. ~/.ssh/id_rsa). If the parser follows
 * it, the secret's bytes are read into the canonical model and then copied into
 * the materialized pack the victim redistributes. The skill parser was already
 * hardened (readDirRecursiveNoSymlinks); these three must match.
 */
const ROOT = join(tmpdir(), 'agentsmesh-symlink-exfil-test');
const SECRET = '-----BEGIN OPENSSH PRIVATE KEY----- TOPSECRET';

let symlinkSupported = true;

function makeSecretTarget(): string {
  const secretPath = join(ROOT, 'secret.md');
  writeFileSync(secretPath, `---\ndescription: stolen\n---\n${SECRET}`);
  return secretPath;
}

function plantSymlink(dir: string, name: string, target: string): void {
  try {
    symlinkSync(target, join(dir, name));
  } catch {
    symlinkSupported = false;
  }
}

beforeEach(() => {
  symlinkSupported = true;
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('canonical parsers do not follow symlinks (host-secret exfiltration)', () => {
  it('parseRules ignores symlinked rule files', async (ctx) => {
    const dir = join(ROOT, 'rules');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'real.md'), `---\ndescription: ok\n---\nlegit rule`);
    plantSymlink(dir, 'evil.md', makeSecretTarget());
    // Explicit skip (not a silent no-op) on a runner that cannot create symlinks
    // — otherwise the test would pass green with zero assertions on Windows CI.
    if (!symlinkSupported) return ctx.skip();

    const rules = await parseRules(dir);
    expect(rules).toHaveLength(1);
    expect(JSON.stringify(rules)).not.toContain('TOPSECRET');
  });

  it('parseCommands ignores symlinked command files', async (ctx) => {
    const dir = join(ROOT, 'commands');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'real.md'), `---\ndescription: ok\n---\nlegit command`);
    plantSymlink(dir, 'evil.md', makeSecretTarget());
    if (!symlinkSupported) return ctx.skip();

    const commands = await parseCommands(dir);
    expect(commands).toHaveLength(1);
    expect(JSON.stringify(commands)).not.toContain('TOPSECRET');
  });

  it('parseAgents ignores symlinked agent files', async (ctx) => {
    const dir = join(ROOT, 'agents');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'real.md'), `---\ndescription: ok\n---\nlegit agent`);
    plantSymlink(dir, 'evil.md', makeSecretTarget());
    if (!symlinkSupported) return ctx.skip();

    const agents = await parseAgents(dir);
    expect(agents).toHaveLength(1);
    expect(JSON.stringify(agents)).not.toContain('TOPSECRET');
  });
});
