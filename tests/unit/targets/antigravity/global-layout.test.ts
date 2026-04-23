import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('antigravity global layout — paths', () => {
  const layout = getTargetLayout('antigravity', 'global')!;

  it('resolves rule path to .gemini/antigravity/GEMINI.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.gemini/antigravity/GEMINI.md');
  });

  it('resolves command path to .gemini/antigravity/workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.gemini/antigravity/workflows/deploy.md',
    );
  });

  it('suppresses agent path (returns null)', () => {
    expect(layout.paths.agentPath('reviewer', {} as never)).toBeNull();
  });
});

describe('antigravity global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('antigravity', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites .agents/rules/general.md to .gemini/antigravity/GEMINI.md', () => {
    expect(rewrite('.agents/rules/general.md')).toBe('.gemini/antigravity/GEMINI.md');
  });

  it('suppresses per-rule files (returns null)', () => {
    expect(rewrite('.agents/rules/typescript.md')).toBeNull();
    expect(rewrite('.agents/rules/testing.md')).toBeNull();
  });

  it('rewrites .agents/skills/ to .gemini/antigravity/skills/', () => {
    expect(rewrite('.agents/skills/ts-pro/SKILL.md')).toBe(
      '.gemini/antigravity/skills/ts-pro/SKILL.md',
    );
  });

  it('rewrites .agents/workflows/ to .gemini/antigravity/workflows/', () => {
    expect(rewrite('.agents/workflows/deploy.md')).toBe('.gemini/antigravity/workflows/deploy.md');
  });

  it('rewrites .agents/antigravity/mcp_config.json to .gemini/antigravity/mcp_config.json', () => {
    expect(rewrite('.agents/antigravity/mcp_config.json')).toBe(
      '.gemini/antigravity/mcp_config.json',
    );
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.gemini/antigravity/other/file.md')).toBe('.gemini/antigravity/other/file.md');
  });
});

describe('antigravity global layout — no mirrorGlobalPath', () => {
  const layout = getTargetLayout('antigravity', 'global')!;

  it('has no mirrorGlobalPath (antigravity uses .gemini/antigravity/ namespace)', () => {
    expect(layout.mirrorGlobalPath).toBeUndefined();
  });
});
