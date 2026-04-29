import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedSkillWithFallback,
} from '../../../../src/targets/import/import-metadata-serialize.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-cov-meta-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('serializeImportedCommandWithFallback — branch coverage', () => {
  it('falls back to existing camelCase allowedTools when imported has none', async () => {
    const destPath = join(dir, 'cmd.md');
    writeFileSync(destPath, '---\nallowedTools: ["Edit", "Read"]\n---\n\nold body');
    const out = await serializeImportedCommandWithFallback(
      destPath,
      { hasDescription: false, hasAllowedTools: false },
      'new body',
    );
    expect(out).toContain('Edit');
    expect(out).toContain('Read');
    expect(out).toContain('new body');
  });

  it('falls back to existing kebab-case allowed-tools when camelCase missing', async () => {
    const destPath = join(dir, 'cmd2.md');
    writeFileSync(destPath, '---\nallowed-tools: ["Bash"]\n---\n\nold');
    const out = await serializeImportedCommandWithFallback(
      destPath,
      { hasDescription: false, hasAllowedTools: false },
      'new',
    );
    expect(out).toContain('Bash');
  });

  it('uses imported description when hasDescription is true (overrides existing)', async () => {
    const destPath = join(dir, 'cmd3.md');
    writeFileSync(destPath, '---\ndescription: ORIG\n---\n\nold');
    const out = await serializeImportedCommandWithFallback(
      destPath,
      { hasDescription: true, description: 'NEW', hasAllowedTools: false },
      'body',
    );
    expect(out).toContain('description: NEW');
  });

  it('uses existing description when import has none and existing is string', async () => {
    const destPath = join(dir, 'cmd4.md');
    writeFileSync(destPath, '---\ndescription: KEEP\n---\n\nbody');
    const out = await serializeImportedCommandWithFallback(
      destPath,
      { hasDescription: false, hasAllowedTools: false },
      'body',
    );
    expect(out).toContain('description: KEEP');
  });

  it('uses empty allowedTools array when hasAllowedTools is true with undefined value', async () => {
    const destPath = join(dir, 'cmd5.md');
    const out = await serializeImportedCommandWithFallback(
      destPath,
      { hasDescription: true, description: 'D', hasAllowedTools: true },
      'b',
    );
    expect(out).toContain('allowed-tools: []');
  });
});

describe('serializeImportedSkillWithFallback — branch coverage', () => {
  it('uses existing name when imported has no name and dir basename mismatch', async () => {
    mkdirSync(join(dir, 'my-skill'), { recursive: true });
    const destPath = join(dir, 'my-skill', 'SKILL.md');
    writeFileSync(destPath, '---\nname: keep-name\ndescription: D\n---\nbody');
    const out = await serializeImportedSkillWithFallback(destPath, {}, 'new body');
    expect(out).toContain('name: keep-name');
    expect(out).toContain('description: D');
  });

  it('falls back to dir basename when neither imported nor existing has name', async () => {
    mkdirSync(join(dir, 'auto-name'), { recursive: true });
    const destPath = join(dir, 'auto-name', 'SKILL.md');
    const out = await serializeImportedSkillWithFallback(destPath, {}, 'b');
    expect(out).toContain('name: auto-name');
    expect(out).toContain('description: ""');
  });
});

describe('serializeImportedAgentWithFallback — branch coverage', () => {
  it('falls back to existing tools when import omits tools', async () => {
    const destPath = join(dir, 'agent.md');
    writeFileSync(destPath, '---\ntools: ["X"]\n---\nbody');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('- X');
  });

  it('uses imported disallowed-tools (kebab) when camelCase absent in import', async () => {
    const destPath = join(dir, 'agent2.md');
    const out = await serializeImportedAgentWithFallback(
      destPath,
      { 'disallowed-tools': ['Sudo'] },
      'b',
    );
    expect(out).toContain('Sudo');
  });

  it('falls back to existing disallowedTools when import has none', async () => {
    const destPath = join(dir, 'agent3.md');
    writeFileSync(destPath, '---\ndisallowedTools: ["Block"]\n---\nb');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('Block');
  });

  it('uses imported mcp-servers when camelCase absent', async () => {
    const destPath = join(dir, 'agent4.md');
    const out = await serializeImportedAgentWithFallback(
      destPath,
      { 'mcp-servers': ['srv1'] },
      'b',
    );
    expect(out).toContain('srv1');
  });

  it('falls back to existing mcpServers when import omits both', async () => {
    const destPath = join(dir, 'agent5.md');
    writeFileSync(destPath, '---\nmcpServers: ["existing"]\n---\nb');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('existing');
  });

  it('uses imported skills array', async () => {
    const destPath = join(dir, 'agent6.md');
    const out = await serializeImportedAgentWithFallback(destPath, { skills: ['s1'] }, 'b');
    expect(out).toContain('s1');
  });

  it('falls back to existing skills when import omits', async () => {
    const destPath = join(dir, 'agent7.md');
    writeFileSync(destPath, '---\nskills: ["fromExisting"]\n---\nb');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('fromExisting');
  });

  it('falls back to existing maxTurns and reads existing memory and model', async () => {
    const destPath = join(dir, 'agent8.md');
    writeFileSync(
      destPath,
      '---\nmaxTurns: 5\nmodel: opus\npermission-mode: allow\nmemory: /m.md\n---\nb',
    );
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('maxTurns: 5');
    expect(out).toContain('model: opus');
    expect(out).toContain('permissionMode: allow');
    expect(out).toContain('memory: /m.md');
  });

  it('keeps maxTurns when imported as max-turns string', async () => {
    const destPath = join(dir, 'agent9.md');
    const out = await serializeImportedAgentWithFallback(destPath, { 'max-turns': '7' }, 'b');
    expect(out).toContain('maxTurns: 7');
  });

  it('reads hooks from imported when present', async () => {
    const destPath = join(dir, 'agent10.md');
    const out = await serializeImportedAgentWithFallback(
      destPath,
      { hooks: { onSave: 'echo' } },
      'b',
    );
    expect(out).toContain('onSave: echo');
  });

  it('reads hooks from existing when imported has none', async () => {
    const destPath = join(dir, 'agent11.md');
    writeFileSync(destPath, '---\nhooks:\n  onLoad: ls\n---\nb');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('onLoad: ls');
  });

  it('uses base filename when name missing in both imported and existing', async () => {
    const destPath = join(dir, 'fallback-name.md');
    const out = await serializeImportedAgentWithFallback(destPath, {}, 'b');
    expect(out).toContain('name: fallback-name');
  });

  it('uses imported permission-mode (kebab) when camelCase absent', async () => {
    const destPath = join(dir, 'agent12.md');
    const out = await serializeImportedAgentWithFallback(
      destPath,
      { 'permission-mode': 'plan' },
      'b',
    );
    expect(out).toContain('permissionMode: plan');
  });
});
