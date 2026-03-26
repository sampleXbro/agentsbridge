/**
 * Unit tests for generate command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import { vi } from 'vitest';
import { runGenerate, ensurePathInsideRoot } from '../../../../src/cli/commands/generate.js';

const TEST_DIR = join(tmpdir(), 'am-generate-unit');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runGenerate', () => {
  it('rejects output paths that escape project root', () => {
    expect(() => ensurePathInsideRoot('/repo', '../outside.txt', 'codex-cli')).toThrow(
      /Unsafe generated output path/i,
    );
  });

  it('accepts output paths under project root', () => {
    expect(ensurePathInsideRoot('/repo', '.codex/config.toml', 'codex-cli')).toContain(
      '/repo/.codex/config.toml',
    );
  });

  it('rejects the deprecated --features flag', async () => {
    await expect(runGenerate({ features: 'rules' }, TEST_DIR)).rejects.toThrow(
      /--features is no longer supported/i,
    );
  });

  it('handles no root rule (results.length === 0)', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      `---
description: "Other rule"
---
# Other
`,
    );

    await runGenerate({}, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(false);
  });

  it('dry-run logs instead of writing when results exist', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Root"
---
# Root
`,
    );

    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      await runGenerate({ 'dry-run': true }, TEST_DIR);
      expect(output).toMatch(/dry-run|created|updated/);
    } finally {
      process.stdout.write = write;
    }
  });

  it('no root rule with dry-run skips writeLock', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      `---
description: "Other"
---
# Other
`,
    );

    await runGenerate({ 'dry-run': true }, TEST_DIR);
  });

  it('no root rule with extends writes lock with extend checksums', async () => {
    const baseDir = join(TEST_DIR, 'base-no-root');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(baseDir, '.agentsmesh', 'rules', 'lib.md'),
      `---
description: "Lib rules"
globs: ["lib/**/*.ts"]
---
# Lib
`,
    );
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ./base-no-root
    features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---
description: "Only"
---
# Only
`,
    );

    await runGenerate({}, TEST_DIR);
    const { readLock } = await import('../../../../src/config/lock.js');
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).not.toBeNull();
    expect(lock!.extends).toBeDefined();
  });

  it('logs created/updated summary when files change', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Root"
---
# Root
`,
    );
    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      await runGenerate({}, TEST_DIR);
      expect(output).toMatch(/created|updated|unchanged/);
      writeFileSync(
        join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Root"
---
# Root v2
`,
      );
      output = '';
      await runGenerate({}, TEST_DIR);
      expect(output).toMatch(/updated|unchanged/);
    } finally {
      process.stdout.write = write;
    }
  });

  it('empty canonical writes lock (results.length === 0 + !dryRun)', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\n`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });

    await runGenerate({}, TEST_DIR);

    const { readLock } = await import('../../../../src/config/lock.js');
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).not.toBeNull();
  });

  it('empty results with extends writes extend checksums in lock (lines 50-51)', async () => {
    const baseDir = join(TEST_DIR, 'base-mcp');
    mkdirSync(join(baseDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [mcp]\nextends:\n  - name: base\n    source: ./base-mcp\n    features: [mcp]\n`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });

    await runGenerate({}, TEST_DIR);

    const { readLock } = await import('../../../../src/config/lock.js');
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).not.toBeNull();
    expect(lock!.extends).toBeDefined();
    expect(typeof lock!.extends).toBe('object');
  });

  it('empty canonical with dry-run skips writeLock (results.length === 0 + dryRun)', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\n`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });

    await runGenerate({ 'dry-run': true }, TEST_DIR);

    const { readLock } = await import('../../../../src/config/lock.js');
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).toBeNull();
  });

  it('check mode succeeds when nothing needs to be generated', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [mcp]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });

    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      await expect(runGenerate({ check: true }, TEST_DIR)).resolves.toBe(0);
      expect(output).toContain('Generated files are in sync.');
    } finally {
      process.stdout.write = write;
    }
  });

  it('check mode reports drift when generated files would change', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Root"
---
# Root
`,
    );

    let output = '';
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      await expect(runGenerate({ check: true }, TEST_DIR)).resolves.toBe(1);
      expect(output).toContain('[check] created .claude/CLAUDE.md (claude-code)');
      expect(output).toContain('Generated files are out of sync.');
    } finally {
      process.stderr.write = write;
    }
  });

  it('unchanged summary skips "Generated:" log when all files unchanged', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\n`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: "Root"\n---\n# Root\n`,
    );

    await runGenerate({}, TEST_DIR);

    const logs: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      logs.push(String(chunk));
      return true;
    };
    try {
      await runGenerate({}, TEST_DIR);
      const output = logs.join('');
      expect(output).not.toContain('Generated:');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('filters to no targets when targets flag matches none', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Root"
---
# Root
`,
    );
    await runGenerate({ targets: 'nonexistent-target' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(TEST_DIR, '.cursor', 'rules', '_root.mdc'))).toBe(false);
  });

  it('writes lock with extend checksums when extends present', async () => {
    const baseDir = join(TEST_DIR, 'base-config');
    mkdirSync(join(baseDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(baseDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Base"
---
# Base
`,
    );

    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: base
    source: ./base-config
    features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Local"
---
# Local
`,
    );

    await runGenerate({}, TEST_DIR);
    const { readLock } = await import('../../../../src/config/lock.js');
    const lock = await readLock(join(TEST_DIR, '.agentsmesh'));
    expect(lock).not.toBeNull();
    expect(lock!.extends).toBeDefined();
    expect(typeof lock!.extends).toBe('object');
  });

  it('refreshes cached remote extends when --refresh-cache is used', async () => {
    const cacheDir = join(TEST_DIR, 'cache');
    const staleRulesDir = join(
      cacheDir,
      'org-refresh-v1_0_0',
      'org-refresh-v1.0.0',
      '.agentsmesh',
      'rules',
    );
    mkdirSync(staleRulesDir, { recursive: true });
    writeFileSync(join(staleRulesDir, '_root.md'), '---\nroot: true\n---\n# Stale cache\n');

    const srcDir = join(TEST_DIR, 'remote-src');
    const freshRulesDir = join(srcDir, 'org-refresh-v1.0.0', '.agentsmesh', 'rules');
    mkdirSync(freshRulesDir, { recursive: true });
    writeFileSync(join(freshRulesDir, '_root.md'), '---\nroot: true\n---\n# Fresh cache\n');

    const tarball = join(TEST_DIR, 'refresh.tar.gz');
    await tar.c({ file: tarball, gzip: true, cwd: srcDir }, ['org-refresh-v1.0.0']);
    const tarballBytes = readFileSync(tarball);
    const ab = new ArrayBuffer(tarballBytes.length);
    new Uint8Array(ab).set(new Uint8Array(tarballBytes));

    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: remote-base
    source: github:org/refresh@v1.0.0
    features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });

    const oldCacheEnv = process.env.AGENTSMESH_CACHE;
    process.env.AGENTSMESH_CACHE = cacheDir;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(ab),
      }),
    );

    try {
      await runGenerate({ 'refresh-cache': true }, TEST_DIR, { printMatrix: false });
      expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
        'Fresh cache',
      );
    } finally {
      process.env.AGENTSMESH_CACHE = oldCacheEnv;
      vi.unstubAllGlobals();
    }
  });

  it('rejects locked-feature changes for collaboration.strategy=lock unless --force is used', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
---
# Locked rules changed
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      `generated_at: "2026-03-22T10:00:00Z"
generated_by: test
lib_version: "0.1.0"
checksums:
  rules/_root.md: "sha256:${'0'.repeat(64)}"
extends: {}
packs: {}
`,
    );

    await expect(runGenerate({}, TEST_DIR, { printMatrix: false })).rejects.toThrow(
      /Locked feature violation/i,
    );

    await expect(runGenerate({ force: true }, TEST_DIR, { printMatrix: false })).resolves.toBe(0);
    expect(existsSync(join(TEST_DIR, '.claude', 'CLAUDE.md'))).toBe(true);
  });
});
