import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import { mergeIntoPack } from '../../../src/install/pack/pack-merge.js';
import type { PackMetadata } from '../../../src/install/pack/pack-schema.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

let tmpDir: string;
let srcDir: string;
let packDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `pack-merge-test-${Date.now()}`);
  srcDir = join(tmpDir, 'src');
  packDir = join(tmpDir, 'my-pack');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(packDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeRuleFile(name: string, body: string): string {
  const dir = join(srcDir, 'rules');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `---\nroot: false\ndescription: ${name}\n---\n\n${body}`, 'utf-8');
  return path;
}

function writeCommandFile(name: string): string {
  const dir = join(srcDir, 'commands');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  writeFileSync(path, `---\ndescription: ${name}\n---\n\nbody`, 'utf-8');
  return path;
}

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

const BASE_META: PackMetadata = {
  name: 'my-pack',
  source: 'github:org/repo@abc123',
  version: 'abc123',
  source_kind: 'github',
  installed_at: '2026-03-22T10:00:00Z',
  updated_at: '2026-03-22T10:00:00Z',
  features: ['rules'],
  content_hash: 'sha256:oldhash',
};

describe('mergeIntoPack', () => {
  it('adds new rules to an existing pack', async () => {
    // Existing pack has a rule file
    const existingRuleDir = join(packDir, 'rules');
    mkdirSync(existingRuleDir);
    writeFileSync(join(existingRuleDir, 'old.md'), '# old rule', 'utf-8');

    // New canonical has a new rule
    const newRulePath = writeRuleFile('new-rule', 'new body');
    const newCanonical = makeCanonical({
      rules: [
        {
          source: newRulePath,
          root: false,
          targets: [],
          description: 'new rule',
          globs: [],
          body: 'new body',
        },
      ],
    });

    const updatedMeta = await mergeIntoPack(packDir, BASE_META, newCanonical, ['rules'], undefined);

    expect(existsSync(join(packDir, 'rules', 'old.md'))).toBe(true);
    expect(existsSync(join(packDir, 'rules', 'new-rule.md'))).toBe(true);
    expect(updatedMeta.features).toContain('rules');
    expect(updatedMeta.updated_at).not.toBe(BASE_META.updated_at);
    expect(updatedMeta.content_hash).not.toBe('sha256:oldhash');
  });

  it('expands features list when new feature added', async () => {
    const cmdPath = writeCommandFile('deploy');
    const newCanonical = makeCanonical({
      commands: [
        {
          source: cmdPath,
          name: 'deploy',
          description: 'deploy',
          allowedTools: [],
          body: 'body',
        },
      ],
    });

    const updatedMeta = await mergeIntoPack(
      packDir,
      BASE_META,
      newCanonical,
      ['commands'],
      undefined,
    );

    expect(updatedMeta.features).toContain('rules');
    expect(updatedMeta.features).toContain('commands');
    expect(existsSync(join(packDir, 'commands', 'deploy.md'))).toBe(true);
  });

  it('merges pick when new pick provided', async () => {
    const existingMeta: PackMetadata = {
      ...BASE_META,
      pick: { skills: ['tdd'] },
    };

    const updatedMeta = await mergeIntoPack(packDir, existingMeta, makeCanonical(), ['skills'], {
      skills: ['code-review'],
    });

    expect(updatedMeta.pick?.skills).toContain('tdd');
    expect(updatedMeta.pick?.skills).toContain('code-review');
  });

  it('removes pick restriction when new install has no pick for that feature (all)', async () => {
    const existingMeta: PackMetadata = {
      ...BASE_META,
      pick: { skills: ['tdd'] },
    };

    // Installing skills with no pick = install all
    const updatedMeta = await mergeIntoPack(
      packDir,
      existingMeta,
      makeCanonical(),
      ['skills'],
      undefined,
    );

    // pick.skills should be removed (no restriction = all)
    expect(updatedMeta.pick?.skills).toBeUndefined();
  });

  it('updates content_hash after merge', async () => {
    const newRulePath = writeRuleFile('ts', 'TypeScript rule');
    const newCanonical = makeCanonical({
      rules: [
        {
          source: newRulePath,
          root: false,
          targets: [],
          description: 'ts',
          globs: [],
          body: 'TypeScript rule',
        },
      ],
    });

    const updatedMeta = await mergeIntoPack(packDir, BASE_META, newCanonical, ['rules'], undefined);
    expect(updatedMeta.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(updatedMeta.content_hash).not.toBe(BASE_META.content_hash);
  });

  it('updates pack.yaml after merge', async () => {
    const newRulePath = writeRuleFile('x', 'body');
    const newCanonical = makeCanonical({
      rules: [
        {
          source: newRulePath,
          root: false,
          targets: [],
          description: 'x',
          globs: [],
          body: 'body',
        },
      ],
    });

    const updatedMeta = await mergeIntoPack(packDir, BASE_META, newCanonical, ['rules'], undefined);

    const packYamlContent = readFileSync(join(packDir, 'pack.yaml'), 'utf-8');
    const parsed = yamlParse(packYamlContent) as Record<string, unknown>;
    expect(parsed.content_hash).toBe(updatedMeta.content_hash);
    expect(parsed.updated_at).toBe(updatedMeta.updated_at);
  });

  it('refreshes source/version metadata when the latest install resolves to a new remote pin', async () => {
    const newRulePath = writeRuleFile('latest', 'body');
    const newCanonical = makeCanonical({
      rules: [
        {
          source: newRulePath,
          root: false,
          targets: [],
          description: 'latest',
          globs: [],
          body: 'body',
        },
      ],
    });

    const updatedMeta = await mergeIntoPack(
      packDir,
      BASE_META,
      newCanonical,
      ['rules'],
      undefined,
      {
        source: 'github:org/repo@def456',
        version: 'def456',
        target: 'gemini-cli',
        path: '.gemini/commands',
      },
    );

    expect(updatedMeta.source).toBe('github:org/repo@def456');
    expect(updatedMeta.version).toBe('def456');
    expect(updatedMeta.target).toBe('gemini-cli');
    expect(updatedMeta.path).toBeUndefined();
  });
});
