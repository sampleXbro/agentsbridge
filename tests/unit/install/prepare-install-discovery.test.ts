/**
 * Install discovery prep: native import at repo root, Gemini path picks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareInstallDiscovery } from '../../../src/install/prepare-install-discovery.js';

const mockImport = vi.hoisted(() =>
  vi.fn<[string, string], Promise<unknown[]>>().mockImplementation(async (root: string) => {
    mkdirSync(join(root, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(root, '.agentsmesh', 'commands', 'alpha.md'),
      '---\ndescription: a\n---\nAlpha\n',
    );
    return [
      {
        fromTool: 'gemini-cli',
        fromPath: join(root, '.gemini', 'commands', 'alpha.toml'),
        toPath: '.agentsmesh/commands/alpha.md',
        feature: 'commands',
      },
    ];
  }),
);

vi.mock('../../../src/canonical/native-extends-importer.js', () => ({
  importNativeToCanonical: mockImport,
}));

const ROOT = join(tmpdir(), 'ab-prepare-install');

function writeMinimalGeminiCommands(repo: string) {
  mkdirSync(join(repo, '.gemini', 'commands'), { recursive: true });
  writeFileSync(join(repo, '.gemini', 'commands', 'alpha.toml'), 'description = "a"\n');
}

function writeMinimalAgentsmesh(repo: string) {
  mkdirSync(join(repo, '.agentsmesh', 'commands'), { recursive: true });
  writeFileSync(
    join(repo, '.agentsmesh', 'commands', 'keep.md'),
    '---\ndescription: k\n---\n# K\n',
  );
}

describe('prepareInstallDiscovery', () => {
  beforeEach(() => {
    mockImport.mockClear();
    rmSync(ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('imports with explicit target when no .agentsmesh', async () => {
    writeMinimalGeminiCommands(ROOT);
    const contentRoot = join(ROOT, '.gemini', 'commands');
    const r = await prepareInstallDiscovery(ROOT, contentRoot, '.gemini/commands', {
      explicitTarget: 'gemini-cli',
    });
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport.mock.calls[0]?.[0]).not.toBe(ROOT);
    expect(mockImport.mock.calls[0]?.[1]).toBe('gemini-cli');
    expect(r.discoveryRoot).not.toBe(ROOT);
    expect(r.implicitPick?.commands).toContain('alpha');
    expect(r.yamlTarget).toBe('gemini-cli');
    expect(r.importHappened).toBe(true);
    expect(existsSync(join(ROOT, '.agentsmesh'))).toBe(false);
    await r.cleanup?.();
  });

  it('auto-detects gemini-cli and imports when no explicit target', async () => {
    writeMinimalGeminiCommands(ROOT);
    const contentRoot = join(ROOT, '.gemini', 'commands');
    const r = await prepareInstallDiscovery(ROOT, contentRoot, '.gemini/commands', {});
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport.mock.calls[0]?.[0]).not.toBe(ROOT);
    expect(mockImport.mock.calls[0]?.[1]).toBe('gemini-cli');
    expect(r.yamlTarget).toBe('gemini-cli');
    expect(r.importHappened).toBe(true);
    expect(existsSync(join(ROOT, '.agentsmesh'))).toBe(false);
    await r.cleanup?.();
  });

  it('stages native scope when .agentsmesh already exists', async () => {
    writeMinimalGeminiCommands(ROOT);
    writeMinimalAgentsmesh(ROOT);
    const contentRoot = join(ROOT, '.gemini', 'commands');
    const r = await prepareInstallDiscovery(ROOT, contentRoot, '.gemini/commands', {
      explicitTarget: 'gemini-cli',
    });
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport.mock.calls[0]?.[0]).not.toBe(ROOT);
    expect(r.importHappened).toBe(true);
    expect(r.implicitPick?.commands).toContain('alpha');
    expect(r.yamlTarget).toBe('gemini-cli');
    expect(existsSync(join(ROOT, '.agentsmesh', 'rules'))).toBe(false);
    await r.cleanup?.();
  });

  it('rejects invalid --target', async () => {
    await expect(
      prepareInstallDiscovery(ROOT, ROOT, '', { explicitTarget: 'not-a-target' }),
    ).rejects.toThrow();
  });

  it('uses contentRoot for slice when no .agentsmesh and detect returns null', async () => {
    mkdirSync(join(ROOT, 'orphan', 'rules'), { recursive: true });
    writeFileSync(join(ROOT, 'orphan', 'rules', 'solo.md'), '---\n---\n# S\n');
    const contentRoot = join(ROOT, 'orphan', 'rules');
    const r = await prepareInstallDiscovery(ROOT, contentRoot, 'orphan/rules', {});
    expect(mockImport).not.toHaveBeenCalled();
    expect(r.discoveryRoot).toBe(contentRoot);
    expect(r.yamlTarget).toBeUndefined();
  });
});
