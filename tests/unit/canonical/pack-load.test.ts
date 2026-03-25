import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';
import { loadPacksCanonical } from '../../../src/canonical/pack-load.js';
import type { PackMetadata } from '../../../src/install/pack-schema.js';

let tmpDir: string;
let packsDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `pack-load-test-${Date.now()}`);
  packsDir = join(tmpDir, 'packs');
  mkdirSync(packsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writePack(
  name: string,
  meta: Partial<PackMetadata> & { features: PackMetadata['features'] },
  resources: {
    rules?: Record<string, string>;
    commands?: Record<string, string>;
    skills?: Record<string, string>;
  } = {},
): void {
  const packDir = join(packsDir, name);
  mkdirSync(packDir, { recursive: true });

  const fullMeta: PackMetadata = {
    name,
    source: `github:org/${name}@abc123`,
    source_kind: 'github',
    installed_at: '2026-03-22T10:00:00Z',
    updated_at: '2026-03-22T10:00:00Z',
    content_hash: 'sha256:aabbcc',
    ...meta,
  };
  writeFileSync(join(packDir, 'pack.yaml'), yamlStringify(fullMeta), 'utf-8');

  if (resources.rules) {
    const rulesDir = join(packDir, 'rules');
    mkdirSync(rulesDir, { recursive: true });
    for (const [fname, body] of Object.entries(resources.rules)) {
      writeFileSync(
        join(rulesDir, fname),
        `---\nroot: false\ndescription: ${fname}\n---\n\n${body}`,
        'utf-8',
      );
    }
  }

  if (resources.commands) {
    const cmdDir = join(packDir, 'commands');
    mkdirSync(cmdDir, { recursive: true });
    for (const [fname, body] of Object.entries(resources.commands)) {
      writeFileSync(join(cmdDir, fname), `---\ndescription: ${fname}\n---\n\n${body}`, 'utf-8');
    }
  }

  if (resources.skills) {
    for (const [skillName, body] of Object.entries(resources.skills)) {
      const skillDir = join(packDir, 'skills', skillName);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\ndescription: ${skillName} skill\n---\n\n${body}`,
        'utf-8',
      );
    }
  }
}

describe('loadPacksCanonical', () => {
  it('returns empty canonical when packsDir does not exist', async () => {
    const result = await loadPacksCanonical(join(tmpDir, 'nonexistent'));
    expect(result.rules).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.commands).toEqual([]);
  });

  it('loads rules from a pack', async () => {
    writePack('my-pack', { features: ['rules'] }, { rules: { 'security.md': 'Use HTTPS.' } });
    const result = await loadPacksCanonical(tmpDir);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.body).toBe('Use HTTPS.');
  });

  it('loads skills from a pack', async () => {
    writePack('my-pack', { features: ['skills'] }, { skills: { tdd: 'Write tests first.' } });
    const result = await loadPacksCanonical(tmpDir);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe('tdd');
  });

  it('loads commands from a pack', async () => {
    writePack(
      'my-pack',
      { features: ['commands'] },
      { commands: { 'deploy.md': 'Deploy script.' } },
    );
    const result = await loadPacksCanonical(tmpDir);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]?.name).toBe('deploy');
  });

  it('merges resources from multiple packs', async () => {
    writePack('pack-a', { features: ['rules'] }, { rules: { 'rule-a.md': 'body a' } });
    writePack('pack-b', { features: ['rules'] }, { rules: { 'rule-b.md': 'body b' } });
    const result = await loadPacksCanonical(tmpDir);
    expect(result.rules).toHaveLength(2);
  });

  it('filters out features not listed in pack.yaml', async () => {
    // Pack declares only skills but has both rules and skills on disk
    writePack(
      'my-pack',
      { features: ['skills'] },
      {
        rules: { 'leaked.md': 'leaked rule' },
        skills: { tdd: 'TDD skill body' },
      },
    );
    const result = await loadPacksCanonical(tmpDir);
    // rules should be empty (not declared in features)
    expect(result.rules).toEqual([]);
    expect(result.skills).toHaveLength(1);
  });

  it('applies pick when specified in pack.yaml', async () => {
    writePack(
      'my-pack',
      { features: ['skills'], pick: { skills: ['tdd'] } },
      { skills: { tdd: 'TDD', 'code-review': 'CR' } },
    );
    const result = await loadPacksCanonical(tmpDir);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe('tdd');
  });

  it('ignores directories without valid pack.yaml', async () => {
    const badDir = join(packsDir, 'bad-pack');
    mkdirSync(badDir);
    // no pack.yaml
    const result = await loadPacksCanonical(tmpDir);
    expect(result.rules).toEqual([]);
  });
});
