import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from '../../../e2e/helpers/setup.js';
import { buildCodebuffImportPaths } from '../../../../src/core/reference/import-maps/codebuff.js';

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

async function build(scope?: 'project' | 'global'): Promise<Map<string, string>> {
  const refs = new Map<string, string>();
  dir = createTestProject('codebuff-project');
  await buildCodebuffImportPaths(refs, dir, scope);
  return refs;
}

describe('buildCodebuffImportPaths (project)', () => {
  it('maps the root and nested knowledge files onto canonical rules', async () => {
    const refs = await build('project');

    expect(refs.get('AGENTS.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('src/AGENTS.md')).toBe('.agentsmesh/rules/src.md');
  });

  it('maps skills, the projected command and the mcp file', async () => {
    const refs = await build('project');

    expect(refs.get('.agents/skills/api-generator/SKILL.md')).toBe(
      '.agentsmesh/skills/api-generator/SKILL.md',
    );
    expect(refs.get('.agents/skills/api-generator/references/route-checklist.md')).toBe(
      '.agentsmesh/skills/api-generator/references/route-checklist.md',
    );
    expect(refs.get('.agents/skills/am-command-review/SKILL.md')).toBe(
      '.agentsmesh/commands/review.md',
    );
    expect(refs.get('.agents/mcp.json')).toBe('.agentsmesh/mcp.json');
  });

  it('maps the ignore file so a rule linking to it lands on canonical', async () => {
    const refs = await build('project');

    expect(refs.get('.codebuffignore')).toBe('.agentsmesh/ignore');
  });

  it('defaults to project scope', async () => {
    const refs = await build();

    expect(refs.get('AGENTS.md')).toBe('.agentsmesh/rules/_root.md');
  });

  it('never maps a vendored AGENTS.md that import refuses to read', async () => {
    dir = createTestProject('codebuff-project');
    mkdirSync(join(dir, 'node_modules/some-pkg'), { recursive: true });
    writeFileSync(join(dir, 'node_modules/some-pkg/AGENTS.md'), '# Vendor');

    const refs = new Map<string, string>();
    await buildCodebuffImportPaths(refs, dir, 'project');

    expect(refs.has('node_modules/some-pkg/AGENTS.md')).toBe(false);
    expect(refs.get('src/AGENTS.md')).toBe('.agentsmesh/rules/src.md');
  });
});

describe('buildCodebuffImportPaths (global)', () => {
  it('maps the home dotfile and skips project-only surfaces', async () => {
    const refs = await build('global');

    expect(refs.get('.AGENTS.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('.agents/mcp.json')).toBe('.agentsmesh/mcp.json');
    expect(refs.has('AGENTS.md')).toBe(false);
    expect(refs.has('src/AGENTS.md')).toBe(false);
    // `PROJECT_IGNORE_FILES` are resolved per project; there is no home equivalent.
    expect(refs.has('.codebuffignore')).toBe(false);
  });
});
