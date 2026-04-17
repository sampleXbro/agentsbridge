import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('cline global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites non-root rule to Documents/Cline/Rules/', () => {
    expect(rewrite('.clinerules/typescript.md')).toBe('Documents/Cline/Rules/typescript.md');
  });

  it('rewrites nested rule slug to Documents/Cline/Rules/', () => {
    expect(rewrite('.clinerules/testing.md')).toBe('Documents/Cline/Rules/testing.md');
  });

  it('rewrites workflow to Documents/Cline/Workflows/', () => {
    expect(rewrite('.clinerules/workflows/commit.md')).toBe('Documents/Cline/Workflows/commit.md');
  });

  it('rewrites hook to Documents/Cline/Hooks/', () => {
    expect(rewrite('.clinerules/hooks/pre-tooluse-0.sh')).toBe(
      'Documents/Cline/Hooks/pre-tooluse-0.sh',
    );
  });

  it('suppresses AGENTS.md (returns null)', () => {
    expect(rewrite('AGENTS.md')).toBeNull();
  });

  it('passes through .cline/skills/ unchanged', () => {
    expect(rewrite('.cline/skills/foo/SKILL.md')).toBe('.cline/skills/foo/SKILL.md');
  });

  it('passes through .cline/cline_mcp_settings.json unchanged', () => {
    expect(rewrite('.cline/cline_mcp_settings.json')).toBe('.cline/cline_mcp_settings.json');
  });

  it('passes through .clineignore unchanged', () => {
    expect(rewrite('.clineignore')).toBe('.clineignore');
  });
});

describe('cline global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('cline', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .cline/skills/ to .agents/skills/', () => {
    expect(mirror('.cline/skills/foo/SKILL.md', [])).toBe('.agents/skills/foo/SKILL.md');
  });

  it('mirrors nested supporting file under .cline/skills/', () => {
    expect(mirror('.cline/skills/foo/references/checklist.md', [])).toBe(
      '.agents/skills/foo/references/checklist.md',
    );
  });

  it('returns null for .clineignore (not mirrored)', () => {
    expect(mirror('.clineignore', [])).toBeNull();
  });

  it('returns null for .cline/cline_mcp_settings.json (not mirrored)', () => {
    expect(mirror('.cline/cline_mcp_settings.json', [])).toBeNull();
  });

  it('returns null for Documents/Cline/Rules/ paths (not mirrored)', () => {
    expect(mirror('Documents/Cline/Rules/typescript.md', [])).toBeNull();
  });
});
