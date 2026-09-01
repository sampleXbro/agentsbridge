import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildOpenhandsImportPaths } from '../../../../src/core/reference/import-maps/openhands.js';

let dir = '';

function write(relPath: string, content = 'x'): void {
  const abs = join(dir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

async function build(scope: 'project' | 'global'): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  await buildOpenhandsImportPaths(refs, dir, scope);
  return refs;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-openhands-map-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('buildOpenhandsImportPaths', () => {
  it('maps AGENTS.md to the canonical root rule at project scope', async () => {
    expect((await build('project')).get('AGENTS.md')).toBe('.agentsmesh/rules/_root.md');
  });

  it('maps the global skill root file to the canonical root rule at global scope', async () => {
    const refs = await build('global');
    expect(refs.get('.agents/skills/_root.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.has('AGENTS.md')).toBe(false);
  });

  it('maps flat skill-directory markdown to canonical rules, not canonical skills', async () => {
    write('.agents/skills/typescript.md');
    expect((await build('project')).get('.agents/skills/typescript.md')).toBe(
      '.agentsmesh/rules/typescript.md',
    );
  });

  it('maps nested skill bundles through the shared skill mapping', async () => {
    write('.agents/skills/api-generator/SKILL.md');
    write('.agents/skills/api-generator/template.ts');
    const refs = await build('project');
    expect(refs.get('.agents/skills/api-generator/SKILL.md')).toBe(
      '.agentsmesh/skills/api-generator/SKILL.md',
    );
    expect(refs.get('.agents/skills/api-generator/template.ts')).toBe(
      '.agentsmesh/skills/api-generator/template.ts',
    );
  });

  it('maps agents and plugin commands', async () => {
    write('.agents/agents/code-reviewer.md');
    write('.agents/plugins/agentsmesh/commands/review.md');
    const refs = await build('project');
    expect(refs.get('.agents/agents/code-reviewer.md')).toBe('.agentsmesh/agents/code-reviewer.md');
    expect(refs.get('.agents/plugins/agentsmesh/commands/review.md')).toBe(
      '.agentsmesh/commands/review.md',
    );
  });

  it('never maps the global root file as a plain rule', async () => {
    write('.agents/skills/_root.md');
    expect((await build('global')).get('.agents/skills/_root.md')).toBe(
      '.agentsmesh/rules/_root.md',
    );
  });

  it('defaults to project scope', async () => {
    const refs = new Map<string, string>();
    await buildOpenhandsImportPaths(refs, dir);
    expect(refs.get('AGENTS.md')).toBe('.agentsmesh/rules/_root.md');
  });
});
