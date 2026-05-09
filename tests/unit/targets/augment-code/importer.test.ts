import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromAugmentCode } from '../../../../src/targets/augment-code/importer.js';

function createTmpDir(): string {
  const dir = join(tmpdir(), `augment-code-importer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

let tmpDir = '';

beforeEach(() => {
  tmpDir = createTmpDir();
});

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe('importFromAugmentCode', () => {
  it('imports root rule from .augment/rules/_root.md', async () => {
    mkdirSync(join(tmpDir, '.augment', 'rules'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.augment', 'rules', '_root.md'),
      '---\nalways_apply: true\ndescription: Project defaults\n---\n\n# Root\n\nUse TDD.',
    );

    const results = await importFromAugmentCode(tmpDir);

    const ruleResult = results.find((r) => r.feature === 'rules');
    expect(ruleResult).toBeDefined();
    expect(ruleResult!.toPath).toBe('.agentsmesh/rules/_root.md');
    expect(ruleResult!.fromTool).toBe('augment-code');
  });

  it('imports non-root rules from .augment/rules/', async () => {
    mkdirSync(join(tmpDir, '.augment', 'rules'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.augment', 'rules', 'typescript.md'),
      '---\nalways_apply: true\n---\n\nUse strict TypeScript.',
    );

    const results = await importFromAugmentCode(tmpDir);

    const ruleResult = results.find(
      (r) => r.feature === 'rules' && r.toPath.includes('typescript'),
    );
    expect(ruleResult).toBeDefined();
    expect(ruleResult!.toPath).toBe('.agentsmesh/rules/typescript.md');
  });

  it('imports commands from .augment/commands/', async () => {
    mkdirSync(join(tmpDir, '.augment', 'commands'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.augment', 'commands', 'review.md'),
      '---\ndescription: Review code\n---\n\nReview the code: $ARGUMENTS',
    );

    const results = await importFromAugmentCode(tmpDir);

    const cmdResult = results.find((r) => r.feature === 'commands');
    expect(cmdResult).toBeDefined();
    expect(cmdResult!.toPath).toBe('.agentsmesh/commands/review.md');
    expect(cmdResult!.fromTool).toBe('augment-code');
  });

  it('imports MCP servers from .augment/settings.json', async () => {
    mkdirSync(join(tmpDir, '.augment'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.augment', 'settings.json'),
      JSON.stringify({
        mcpServers: {
          context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
        },
      }),
    );

    const results = await importFromAugmentCode(tmpDir);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');
    expect(mcpResult!.fromTool).toBe('augment-code');
  });

  it('imports hooks from .augment/settings.json', async () => {
    mkdirSync(join(tmpDir, '.augment'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.augment', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'launch-process',
              hooks: [{ type: 'command', command: 'scripts/check.sh' }],
            },
          ],
        },
      }),
    );

    const results = await importFromAugmentCode(tmpDir);

    const hookResult = results.find((r) => r.feature === 'hooks');
    expect(hookResult).toBeDefined();
    expect(hookResult!.toPath).toBe('.agentsmesh/hooks.yaml');
    expect(hookResult!.fromTool).toBe('augment-code');
  });

  it('imports .augmentignore patterns', async () => {
    writeFileSync(join(tmpDir, '.augmentignore'), '# Build\ndist/\nnode_modules/\n.env\n');
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });

    const results = await importFromAugmentCode(tmpDir);

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.toPath).toBe('.agentsmesh/ignore');
    expect(ignoreResult!.fromTool).toBe('augment-code');
  });

  it('returns empty array when no config exists', async () => {
    const results = await importFromAugmentCode(tmpDir);
    expect(results).toHaveLength(0);
  });
});
