import { describe, it, expect } from 'vitest';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';

describe('windsurf global layout — paths', () => {
  const layout = getTargetLayout('windsurf', 'global')!;

  it('resolves rule path to .codeium/windsurf/memories/global_rules.md (aggregate)', () => {
    expect(
      layout.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.codeium/windsurf/memories/global_rules.md');
  });

  it('resolves command path to .codeium/windsurf/global_workflows/', () => {
    expect(layout.paths.commandPath('deploy', {} as never)).toBe(
      '.codeium/windsurf/global_workflows/deploy.md',
    );
  });
});

describe('windsurf global layout — rewriteGeneratedPath', () => {
  const layout = getTargetLayout('windsurf', 'global')!;
  const rewrite = layout.rewriteGeneratedPath!;

  it('rewrites AGENTS.md to .codeium/windsurf/memories/global_rules.md', () => {
    expect(rewrite('AGENTS.md')).toBe('.codeium/windsurf/memories/global_rules.md');
  });

  it('suppresses src/AGENTS.md in global mode (directory-scoped rule output)', () => {
    expect(rewrite('src/AGENTS.md')).toBeNull();
  });

  it('suppresses .windsurf/rules/ in global mode (returns null)', () => {
    expect(rewrite('.windsurf/rules/typescript.md')).toBeNull();
    expect(rewrite('.windsurf/rules/testing.md')).toBeNull();
  });

  it('rewrites .windsurf/skills/ to .codeium/windsurf/skills/', () => {
    expect(rewrite('.windsurf/skills/ts-pro/SKILL.md')).toBe(
      '.codeium/windsurf/skills/ts-pro/SKILL.md',
    );
  });

  it('rewrites .windsurf/workflows/ to .codeium/windsurf/global_workflows/', () => {
    expect(rewrite('.windsurf/workflows/deploy.md')).toBe(
      '.codeium/windsurf/global_workflows/deploy.md',
    );
  });

  it('rewrites .windsurf/hooks.json to .codeium/windsurf/hooks.json', () => {
    expect(rewrite('.windsurf/hooks.json')).toBe('.codeium/windsurf/hooks.json');
  });

  it('rewrites .windsurf/mcp_config.example.json to .codeium/windsurf/mcp_config.json', () => {
    expect(rewrite('.windsurf/mcp_config.example.json')).toBe('.codeium/windsurf/mcp_config.json');
  });

  it('rewrites .codeiumignore to .codeium/.codeiumignore', () => {
    expect(rewrite('.codeiumignore')).toBe('.codeium/.codeiumignore');
  });

  it('returns unchanged path for unrecognized paths', () => {
    expect(rewrite('.codeium/windsurf/other/file.md')).toBe('.codeium/windsurf/other/file.md');
  });
});

describe('windsurf global layout — mirrorGlobalPath', () => {
  const layout = getTargetLayout('windsurf', 'global')!;
  const mirror = layout.mirrorGlobalPath!;

  it('mirrors .codeium/windsurf/skills/ to .agents/skills/', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/SKILL.md', [])).toBe(
      '.agents/skills/ts-pro/SKILL.md',
    );
  });

  it('mirrors nested supporting file under .codeium/windsurf/skills/', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/references/checklist.md', [])).toBe(
      '.agents/skills/ts-pro/references/checklist.md',
    );
  });

  it('does not mirror when codex-cli is active', () => {
    expect(mirror('.codeium/windsurf/skills/ts-pro/SKILL.md', ['codex-cli'])).toBeNull();
  });

  it('returns null for global_rules.md (not mirrored)', () => {
    expect(mirror('.codeium/windsurf/memories/global_rules.md', [])).toBeNull();
  });

  it('returns null for workflow files (not mirrored)', () => {
    expect(mirror('.codeium/windsurf/global_workflows/deploy.md', [])).toBeNull();
  });

  it('returns null for MCP file (not mirrored)', () => {
    expect(mirror('.codeium/windsurf/mcp_config.json', [])).toBeNull();
  });

  it('returns null for ignore file (not mirrored)', () => {
    expect(mirror('.codeium/.codeiumignore', [])).toBeNull();
  });
});
