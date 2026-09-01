import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

let dir = '';

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf-8');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-openhands-import-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('importFromOpenhands (project scope)', () => {
  it('finds nothing in an empty project', async () => {
    expect(await importFromOpenhands(dir)).toEqual([]);
  });

  it('imports every native surface into canonical', async () => {
    write('AGENTS.md', '# Standards\n\n- TypeScript strict\n');
    write(
      '.agents/skills/typescript.md',
      '---\ndescription: TypeScript rules\npaths:\n  - src/**/*.ts\n---\n\n# TypeScript\n',
    );
    write('.agents/skills/api/SKILL.md', '---\nname: api\ndescription: API helper\n---\n\nBody\n');
    write('.agents/skills/api/template.ts', 'export {};\n');
    write(
      '.agents/plugins/agentsmesh/commands/review.md',
      '---\ndescription: Code review\nallowed-tools:\n  - Read\n---\n\nReview it.\n',
    );
    write(
      '.agents/agents/code-reviewer.md',
      '---\nname: code-reviewer\ndescription: Reviewer\ntools:\n  - Read\n---\n\nYou review.\n',
    );
    write(
      '.agents/plugins/agentsmesh/.mcp.json',
      JSON.stringify({ mcpServers: { docs: { command: 'npx', args: ['-y', 'docs'] } } }),
    );
    write(
      '.openhands/hooks.json',
      JSON.stringify({
        post_tool_use: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'fmt' }] }],
      }),
    );

    const results = await importFromOpenhands(dir, { scope: 'project' });

    expect([...new Set(results.map((r) => r.toPath))].sort()).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/hooks.yaml',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/typescript.md',
      '.agentsmesh/skills/api/SKILL.md',
      '.agentsmesh/skills/api/template.ts',
    ]);
    expect(results.every((r) => r.fromTool === 'openhands')).toBe(true);
  });

  it('marks AGENTS.md as the root rule', async () => {
    write('AGENTS.md', '# Standards\n');
    await importFromOpenhands(dir);
    expect(read('.agentsmesh/rules/_root.md')).toContain('root: true');
  });

  it('turns the required paths key back into canonical globs and drops paths itself', async () => {
    write(
      '.agents/skills/typescript.md',
      '---\ndescription: TS\npaths:\n  - src/**/*.ts\n  - test/**/*.ts\n---\n\n# TypeScript\n',
    );
    await importFromOpenhands(dir);
    const imported = read('.agentsmesh/rules/typescript.md');
    expect(imported).toContain('globs:');
    expect(imported).toContain('src/**/*.ts');
    expect(imported).toContain('test/**/*.ts');
    expect(imported).not.toContain('paths:');
  });

  it('accepts a comma-separated paths string', async () => {
    write('.agents/skills/scoped.md', '---\npaths: src/**/*.ts, docs/**/*.md\n---\n\nBody\n');
    await importFromOpenhands(dir);
    const imported = read('.agentsmesh/rules/scoped.md');
    expect(imported).toContain('src/**/*.ts');
    expect(imported).toContain('docs/**/*.md');
  });

  it('never treats a nested SKILL.md as a flat path-scoped rule', async () => {
    write('.agents/skills/api/SKILL.md', '---\nname: api\n---\n\nBody\n');
    const results = await importFromOpenhands(dir);
    expect(results.filter((r) => r.feature === 'rules')).toEqual([]);
  });

  it('ignores a global-style _root.md sitting in the project skills dir', async () => {
    write('AGENTS.md', '# Project root\n');
    write('.agents/skills/_root.md', '# Global root\n');
    await importFromOpenhands(dir, { scope: 'project' });
    expect(read('.agentsmesh/rules/_root.md')).toContain('# Project root');
  });
});

describe('importFromOpenhands (global scope)', () => {
  it('reads the root rule from the always-injected global skill file', async () => {
    write('.agents/skills/_root.md', '# Global standards\n');
    const results = await importFromOpenhands(dir, { scope: 'global' });
    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    const imported = read('.agentsmesh/rules/_root.md');
    expect(imported).toContain('root: true');
    expect(imported).toContain('# Global standards');
  });

  it('does not read AGENTS.md at global scope', async () => {
    write('AGENTS.md', '# Project root\n');
    expect(await importFromOpenhands(dir, { scope: 'global' })).toEqual([]);
  });

  it('imports the shared plugin and openhands surfaces at global scope too', async () => {
    write(
      '.agents/plugins/agentsmesh/commands/review.md',
      '---\ndescription: Code review\n---\n\nReview it.\n',
    );
    write(
      '.openhands/hooks.json',
      JSON.stringify({ stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'bye' }] }] }),
    );
    const results = await importFromOpenhands(dir, { scope: 'global' });
    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/commands/review.md',
      '.agentsmesh/hooks.yaml',
    ]);
    expect(read('.agentsmesh/hooks.yaml')).toContain('Stop');
  });
});
