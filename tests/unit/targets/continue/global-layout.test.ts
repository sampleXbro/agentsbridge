import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('continue global layout — paths', () => {
  const layout = getTargetLayout('continue', 'global')!;

  it('resolves rule path to .continue/rules/', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.continue/rules/typescript.md');
  });

  it('resolves command path to .continue/prompts/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe('.continue/prompts/deploy.md');
  });

  it('suppresses agent path (returns null)', () => {
    expect(layout.paths.agentPath('my-agent', {} as never)).toBeNull();
  });
});

describe('continue global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('continue', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .continue/skills/ to .agents/skills/', () => {
    expect(mirror('.continue/skills/ts-pro/SKILL.md', [])).toBe('.agents/skills/ts-pro/SKILL.md');
  });

  it('mirrors nested supporting file under .continue/skills/', () => {
    expect(mirror('.continue/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('returns null for rule files (not mirrored)', () => {
    expect(mirror('.continue/rules/typescript.md', [])).toBeNull();
  });

  it('returns null for prompt files (not mirrored)', () => {
    expect(mirror('.continue/prompts/commit.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.continue/mcpServers/agentsmesh.json', [])).toBeNull();
  });
});

describe('continue global layout — no rewriteGeneratedPath', () => {
  const layout = getTargetLayout('continue', 'global')!;

  it('has no rewriteGeneratedPath (paths are identity in global mode)', () => {
    expect(layout.rewriteGeneratedPath).toBeUndefined();
  });
});
