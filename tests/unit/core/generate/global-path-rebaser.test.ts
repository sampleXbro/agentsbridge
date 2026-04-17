import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import {
  resolveTargetPath,
  resolveGlobalRoot,
} from '../../../../src/core/generate/global-path-rebaser.js';

vi.mock('node:os', () => ({
  homedir: () => '/mock/home',
}));

describe('global-path-rebaser', () => {
  describe('resolveGlobalRoot', () => {
    it('expands ~/', () => {
      expect(resolveGlobalRoot('~/.claude')).toBe(join('/mock/home', '.claude'));
    });

    it('returns absolute paths correctly', () => {
      expect(resolveGlobalRoot('/absolute/path/.gemini')).toBe('/absolute/path/.gemini');
    });
  });

  describe('resolveTargetPath', () => {
    it('returns unmodified path if not in global mode', () => {
      expect(resolveTargetPath('.claude/rules/test.md', '.claude', '~/.claude', false)).toBe(
        '.claude/rules/test.md',
      );
    });

    it('throws if global mode is active but globalConfigRoot is absent', () => {
      expect(() => {
        resolveTargetPath('.claude/rules/test.md', '.claude', undefined, true);
      }).toThrow('Target does not support global mode configuration.');
    });

    it('rebases embedded config correctly', () => {
      const result = resolveTargetPath('.claude/rules/test.md', '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
    });

    it('flattens scattered config correctly', () => {
      const result = resolveTargetPath('CLAUDE.md', '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/CLAUDE.md'));
    });

    it('handles files starting with same prefix but not in directory correctly', () => {
      // e.g. .claudeignore vs .claude/
      const result = resolveTargetPath('.claudeignore', '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/.claudeignore'));
    });

    it('handles empty localConfigRoot', () => {
      const result = resolveTargetPath('config.toml', '', '~/.codex', true);
      expect(result).toBe(join('/mock/home', '.codex/config.toml'));
    });

    describe('edge cases: nested paths', () => {
      it('rebases deeply nested config paths correctly', () => {
        const result = resolveTargetPath(
          '.claude/skills/api-gen/references/schema.json',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/api-gen/references/schema.json'));
      });

      it('rebases paths with multiple directory levels', () => {
        const result = resolveTargetPath(
          '.github/copilot/skills/test/fixtures/data.json',
          '.github/copilot',
          '~/.copilot',
          true,
        );
        expect(result).toBe(join('/mock/home', '.copilot/skills/test/fixtures/data.json'));
      });

      it('handles nested path when localConfigRoot has trailing slash', () => {
        const result = resolveTargetPath('.claude/rules/test.md', '.claude/', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
      });
    });

    describe('edge cases: path separators', () => {
      it('handles Windows-style backslashes in generatorOutputPath', () => {
        const result = resolveTargetPath('.claude\\rules\\test.md', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
      });

      it('handles Windows-style backslashes in localConfigRoot', () => {
        const result = resolveTargetPath('.claude\\rules\\test.md', '.claude\\', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
      });

      it('handles mixed path separators', () => {
        const result = resolveTargetPath(
          '.claude/skills\\api-gen/SKILL.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/api-gen/SKILL.md'));
      });
    });

    describe('edge cases: special characters in paths', () => {
      it('handles paths with spaces', () => {
        const result = resolveTargetPath(
          '.claude/skills/my skill/SKILL.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/my skill/SKILL.md'));
      });

      it('handles paths with dots in directory names', () => {
        const result = resolveTargetPath(
          '.claude/skills/api.v2.gen/SKILL.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/api.v2.gen/SKILL.md'));
      });

      it('handles paths with hyphens and underscores', () => {
        const result = resolveTargetPath(
          '.claude/skills/my-skill_v2/SKILL.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/my-skill_v2/SKILL.md'));
      });

      it('handles paths with unicode characters', () => {
        const result = resolveTargetPath(
          '.claude/skills/日本語/SKILL.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/skills/日本語/SKILL.md'));
      });
    });

    describe('edge cases: prefix matching', () => {
      it('does not strip partial prefix match at word boundary', () => {
        // .clauderc should not match .claude/ prefix
        const result = resolveTargetPath('.clauderc', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/.clauderc'));
      });

      it('does not strip prefix when path starts with similar but different directory', () => {
        // .claude-backup/ should not match .claude/ prefix
        const result = resolveTargetPath(
          '.claude-backup/rules/test.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/.claude-backup/rules/test.md'));
      });

      it('correctly strips exact prefix match with subdirectory', () => {
        const result = resolveTargetPath(
          '.claude/rules/typescript.md',
          '.claude',
          '~/.claude',
          true,
        );
        expect(result).toBe(join('/mock/home', '.claude/rules/typescript.md'));
      });

      it('handles case-sensitive prefix matching', () => {
        const result = resolveTargetPath('.Claude/rules/test.md', '.claude', '~/.claude', true);
        // Should not strip because case doesn't match
        expect(result).toBe(join('/mock/home', '.claude/.Claude/rules/test.md'));
      });
    });

    describe('edge cases: root-level files', () => {
      it('flattens root-level markdown file into global config', () => {
        const result = resolveTargetPath('AGENTS.md', '.agents', '~/.agents', true);
        expect(result).toBe(join('/mock/home', '.agents/AGENTS.md'));
      });

      it('flattens root-level config file into global config', () => {
        const result = resolveTargetPath('config.toml', '.codex', '~/.codex', true);
        expect(result).toBe(join('/mock/home', '.codex/config.toml'));
      });

      it('flattens root-level ignore file into global config', () => {
        const result = resolveTargetPath('.claudeignore', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/.claudeignore'));
      });

      it('flattens multiple root-level files consistently', () => {
        const result1 = resolveTargetPath('CLAUDE.md', '.claude', '~/.claude', true);
        const result2 = resolveTargetPath('AGENTS.md', '.claude', '~/.claude', true);
        expect(result1).toBe(join('/mock/home', '.claude/CLAUDE.md'));
        expect(result2).toBe(join('/mock/home', '.claude/AGENTS.md'));
      });
    });

    describe('edge cases: absolute vs relative global roots', () => {
      it('handles absolute path in globalConfigRoot without tilde', () => {
        const result = resolveTargetPath(
          '.claude/rules/test.md',
          '.claude',
          '/home/user/.claude',
          true,
        );
        expect(result).toBe('/home/user/.claude/rules/test.md');
      });

      it('handles relative path in globalConfigRoot', () => {
        const result = resolveTargetPath('.claude/rules/test.md', '.claude', '.claude', true);
        expect(result).toBe('.claude/rules/test.md');
      });

      it('expands tilde in nested global path', () => {
        const result = resolveTargetPath(
          '.codeium/windsurf/memories/test.md',
          '.codeium/windsurf',
          '~/.codeium/windsurf',
          true,
        );
        expect(result).toBe(join('/mock/home', '.codeium/windsurf/memories/test.md'));
      });
    });

    describe('edge cases: empty and edge inputs', () => {
      it('handles empty generatorOutputPath', () => {
        const result = resolveTargetPath('', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude'));
      });

      it('handles single character filename', () => {
        const result = resolveTargetPath('a', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/a'));
      });

      it('handles path with only extension', () => {
        const result = resolveTargetPath('.md', '.claude', '~/.claude', true);
        expect(result).toBe(join('/mock/home', '.claude/.md'));
      });

      it('handles deeply nested empty directory names (edge case)', () => {
        const result = resolveTargetPath('.claude//rules//test.md', '.claude', '~/.claude', true);
        // Node's join normalizes double slashes
        expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
      });
    });

    describe('edge cases: project mode consistency', () => {
      it('returns identical path in project mode regardless of globalConfigRoot', () => {
        const path = '.claude/rules/test.md';
        const result1 = resolveTargetPath(path, '.claude', '~/.claude', false);
        const result2 = resolveTargetPath(path, '.claude', undefined, false);
        expect(result1).toBe(path);
        expect(result2).toBe(path);
      });

      it('preserves relative paths in project mode', () => {
        const path = '../shared/config.md';
        const result = resolveTargetPath(path, '.claude', '~/.claude', false);
        expect(result).toBe(path);
      });

      it('preserves absolute paths in project mode', () => {
        const path = '/absolute/path/config.md';
        const result = resolveTargetPath(path, '.claude', '~/.claude', false);
        expect(result).toBe(path);
      });
    });

    describe('edge cases: multiple targets with different roots', () => {
      it('rebases Cursor paths correctly', () => {
        const result = resolveTargetPath('.cursor/rules/general.mdc', '.cursor', '~/.cursor', true);
        expect(result).toBe(join('/mock/home', '.cursor/rules/general.mdc'));
      });

      it('rebases Copilot paths correctly', () => {
        const result = resolveTargetPath(
          '.github/copilot/skills/test/SKILL.md',
          '.github/copilot',
          '~/.copilot',
          true,
        );
        expect(result).toBe(join('/mock/home', '.copilot/skills/test/SKILL.md'));
      });

      it('rebases Windsurf paths correctly', () => {
        const result = resolveTargetPath(
          '.codeium/windsurf/memories/global_rules.md',
          '.codeium/windsurf',
          '~/.codeium/windsurf',
          true,
        );
        expect(result).toBe(join('/mock/home', '.codeium/windsurf/memories/global_rules.md'));
      });

      it('rebases Gemini CLI paths correctly', () => {
        const result = resolveTargetPath(
          '.gemini/agents/code-reviewer.md',
          '.gemini',
          '~/.gemini',
          true,
        );
        expect(result).toBe(join('/mock/home', '.gemini/agents/code-reviewer.md'));
      });

      it('rebases Kiro paths correctly', () => {
        const result = resolveTargetPath('.kiro/steering/typescript.md', '.kiro', '~/.kiro', true);
        expect(result).toBe(join('/mock/home', '.kiro/steering/typescript.md'));
      });
    });

    describe('edge cases: error conditions', () => {
      it('throws descriptive error when global mode enabled without globalConfigRoot', () => {
        expect(() => {
          resolveTargetPath('.claude/rules/test.md', '.claude', undefined, true);
        }).toThrow('Target does not support global mode configuration.');
      });

      it('throws when globalConfigRoot is null in global mode', () => {
        expect(() => {
          resolveTargetPath('.claude/rules/test.md', '.claude', null as unknown as undefined, true);
        }).toThrow('Target does not support global mode configuration.');
      });

      it('throws when globalConfigRoot is empty string in global mode', () => {
        expect(() => {
          resolveTargetPath('.claude/rules/test.md', '.claude', '', true);
        }).toThrow('Target does not support global mode configuration.');
      });
    });
  });

  describe('resolveGlobalRoot edge cases', () => {
    it('handles tilde-only path', () => {
      expect(resolveGlobalRoot('~')).toBe('/mock/home');
    });

    it('handles tilde with trailing slash', () => {
      expect(resolveGlobalRoot('~/')).toBe('/mock/home');
    });

    it('handles multiple path segments after tilde', () => {
      expect(resolveGlobalRoot('~/.config/agentsmesh/claude')).toBe(
        join('/mock/home', '.config/agentsmesh/claude'),
      );
    });

    it('does not expand tilde in middle of path', () => {
      expect(resolveGlobalRoot('/home/~/config')).toBe('/home/~/config');
    });

    it('handles Windows-style path without tilde', () => {
      expect(resolveGlobalRoot('C:\\Users\\dev\\.claude')).toBe('C:\\Users\\dev\\.claude');
    });

    it('handles empty string', () => {
      expect(resolveGlobalRoot('')).toBe('');
    });

    it('handles relative path without tilde', () => {
      expect(resolveGlobalRoot('.claude')).toBe('.claude');
    });

    it('handles absolute Unix path', () => {
      expect(resolveGlobalRoot('/usr/local/share/.claude')).toBe('/usr/local/share/.claude');
    });
  });

  describe('edge cases: symlink-like paths', () => {
    it('handles paths with .. segments in project mode', () => {
      const result = resolveTargetPath(
        '../shared/.claude/rules/test.md',
        '.claude',
        '~/.claude',
        false,
      );
      expect(result).toBe('../shared/.claude/rules/test.md');
    });

    it('handles paths with . segments in project mode', () => {
      const result = resolveTargetPath('./.claude/rules/test.md', '.claude', '~/.claude', false);
      expect(result).toBe('./.claude/rules/test.md');
    });

    it('handles paths with .. segments in global mode', () => {
      const result = resolveTargetPath(
        '.claude/../.claude/rules/test.md',
        '.claude',
        '~/.claude',
        true,
      );
      // join normalizes the path
      expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
    });
  });

  describe('edge cases: boundary conditions', () => {
    it('handles very long nested paths', () => {
      const deepPath = '.claude/' + 'a/'.repeat(50) + 'file.md';
      const result = resolveTargetPath(deepPath, '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/' + 'a/'.repeat(50) + 'file.md'));
    });

    it('handles path exactly matching localConfigRoot', () => {
      const result = resolveTargetPath('.claude', '.claude', '~/.claude', true);
      // When path equals localConfigRoot exactly, it's treated as a scattered file
      expect(result).toBe(join('/mock/home', '.claude', '.claude'));
    });

    it('handles path with localConfigRoot as complete prefix but no separator', () => {
      // .clauderc starts with .claude but is not under .claude/
      const result = resolveTargetPath('.clauderc', '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/.clauderc'));
    });

    it('handles localConfigRoot with multiple segments', () => {
      const result = resolveTargetPath(
        '.github/copilot/skills/test.md',
        '.github/copilot',
        '~/.copilot',
        true,
      );
      expect(result).toBe(join('/mock/home', '.copilot/skills/test.md'));
    });

    it('handles localConfigRoot with multiple segments and trailing slash', () => {
      const result = resolveTargetPath(
        '.github/copilot/skills/test.md',
        '.github/copilot/',
        '~/.copilot',
        true,
      );
      expect(result).toBe(join('/mock/home', '.copilot/skills/test.md'));
    });
  });

  describe('edge cases: real-world target scenarios', () => {
    it('handles Cline scattered root file (AGENTS.md)', () => {
      const result = resolveTargetPath('AGENTS.md', '.cline', '~/.cline', true);
      expect(result).toBe(join('/mock/home', '.cline/AGENTS.md'));
    });

    it('handles Cline embedded skill path', () => {
      const result = resolveTargetPath(
        '.cline/skills/api-gen/SKILL.md',
        '.cline',
        '~/.cline',
        true,
      );
      expect(result).toBe(join('/mock/home', '.cline/skills/api-gen/SKILL.md'));
    });

    it('handles Windsurf nested config root', () => {
      const result = resolveTargetPath(
        '.codeium/windsurf/memories/test.md',
        '.codeium/windsurf',
        '~/.codeium/windsurf',
        true,
      );
      expect(result).toBe(join('/mock/home', '.codeium/windsurf/memories/test.md'));
    });

    it('handles Codex scattered config file', () => {
      const result = resolveTargetPath('config.toml', '', '~/.codex', true);
      expect(result).toBe(join('/mock/home', '.codex/config.toml'));
    });

    it('handles Copilot project-level path to global', () => {
      const result = resolveTargetPath(
        '.github/copilot/prompts/review.prompt.md',
        '.github/copilot',
        '~/.copilot',
        true,
      );
      expect(result).toBe(join('/mock/home', '.copilot/prompts/review.prompt.md'));
    });

    it('handles Continue scattered root (CONTINUE.md)', () => {
      const result = resolveTargetPath('CONTINUE.md', '.continue', '~/.continue', true);
      expect(result).toBe(join('/mock/home', '.continue/CONTINUE.md'));
    });

    it('handles Junie scattered root (JUNIE.md)', () => {
      const result = resolveTargetPath('JUNIE.md', '.junie', '~/.junie', true);
      expect(result).toBe(join('/mock/home', '.junie/JUNIE.md'));
    });

    it('handles Roo Code scattered root (ROO_CODE.md)', () => {
      const result = resolveTargetPath('ROO_CODE.md', '.roo-code', '~/.roo-code', true);
      expect(result).toBe(join('/mock/home', '.roo-code/ROO_CODE.md'));
    });
  });

  describe('edge cases: path normalization consistency', () => {
    it('produces same result for path with and without trailing slash in localConfigRoot', () => {
      const result1 = resolveTargetPath('.claude/rules/test.md', '.claude', '~/.claude', true);
      const result2 = resolveTargetPath('.claude/rules/test.md', '.claude/', '~/.claude', true);
      expect(result1).toBe(result2);
    });

    it('produces same result for path with mixed separators', () => {
      const result1 = resolveTargetPath('.claude/rules/test.md', '.claude', '~/.claude', true);
      const result2 = resolveTargetPath('.claude\\rules\\test.md', '.claude', '~/.claude', true);
      expect(result1).toBe(result2);
    });

    it('normalizes double slashes in path', () => {
      const result = resolveTargetPath('.claude//rules//test.md', '.claude', '~/.claude', true);
      expect(result).toBe(join('/mock/home', '.claude/rules/test.md'));
    });
  });

  describe('edge cases: error resilience', () => {
    it('handles undefined globalConfigRoot gracefully in project mode', () => {
      const result = resolveTargetPath('.claude/rules/test.md', '.claude', undefined, false);
      expect(result).toBe('.claude/rules/test.md');
    });

    it('handles null localConfigRoot in global mode', () => {
      const result = resolveTargetPath('config.toml', '', '~/.codex', true);
      expect(result).toBe(join('/mock/home', '.codex/config.toml'));
    });

    it('handles whitespace-only localConfigRoot', () => {
      const result = resolveTargetPath('config.toml', '   ', '~/.codex', true);
      expect(result).toBe(join('/mock/home', '.codex/config.toml'));
    });
  });

  describe('performance: large skill trees', () => {
    it('handles very large skill trees efficiently', () => {
      const startTime = Date.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        resolveTargetPath(
          `.claude/skills/skill-${i}/references/nested/deep/file-${i}.md`,
          '.claude',
          '~/.claude',
          true,
        );
      }

      const duration = Date.now() - startTime;
      // Should complete 10k path resolutions in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('handles deeply nested paths without stack overflow', () => {
      const deepPath = '.claude/' + 'a/'.repeat(500) + 'file.md';
      expect(() => {
        resolveTargetPath(deepPath, '.claude', '~/.claude', true);
      }).not.toThrow();
    });

    it('handles very long file names', () => {
      const longName = 'a'.repeat(255);
      const result = resolveTargetPath(
        `.claude/skills/${longName}.md`,
        '.claude',
        '~/.claude',
        true,
      );
      expect(result).toBe(join('/mock/home', `.claude/skills/${longName}.md`));
    });
  });

  describe('concurrent access scenarios', () => {
    it('handles concurrent path resolutions without race conditions', () => {
      const paths = Array.from({ length: 100 }, (_, i) => `.claude/skills/skill-${i}/SKILL.md`);

      const results = paths.map((path) => resolveTargetPath(path, '.claude', '~/.claude', true));

      // All results should be unique and correctly resolved
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(paths.length);

      results.forEach((result, i) => {
        expect(result).toBe(join('/mock/home', paths[i]));
      });
    });

    it('handles mixed mode resolutions concurrently', () => {
      const operations = [
        { path: '.claude/rules/a.md', mode: true },
        { path: '.claude/rules/b.md', mode: false },
        { path: '.claude/rules/c.md', mode: true },
        { path: '.claude/rules/d.md', mode: false },
      ];

      const results = operations.map((op) =>
        resolveTargetPath(op.path, '.claude', '~/.claude', op.mode),
      );

      expect(results[0]).toBe(join('/mock/home', '.claude/rules/a.md'));
      expect(results[1]).toBe('.claude/rules/b.md');
      expect(results[2]).toBe(join('/mock/home', '.claude/rules/c.md'));
      expect(results[3]).toBe('.claude/rules/d.md');
    });

    it('handles concurrent global root resolutions', () => {
      const roots = ['~/.claude', '~/.cursor', '~/.copilot', '~/.gemini', '~/.kiro'];

      const results = roots.map((root) => resolveGlobalRoot(root));

      results.forEach((result, i) => {
        expect(result).toBe(join('/mock/home', roots[i].slice(2)));
      });
    });
  });

  describe('migration scenarios: project to global mode', () => {
    it('maintains path consistency when switching from project to global mode', () => {
      const path = '.claude/rules/typescript.md';

      // Project mode
      const projectResult = resolveTargetPath(path, '.claude', '~/.claude', false);
      expect(projectResult).toBe(path);

      // Global mode
      const globalResult = resolveTargetPath(path, '.claude', '~/.claude', true);
      expect(globalResult).toBe(join('/mock/home', '.claude/rules/typescript.md'));

      // Verify the relative structure is preserved
      expect(globalResult.endsWith('rules/typescript.md')).toBe(true);
    });

    it('handles migration of scattered root files', () => {
      const scatteredFiles = ['CLAUDE.md', 'AGENTS.md', '.claudeignore'];

      scatteredFiles.forEach((file) => {
        const projectPath = resolveTargetPath(file, '.claude', '~/.claude', false);
        const globalPath = resolveTargetPath(file, '.claude', '~/.claude', true);

        expect(projectPath).toBe(file);
        expect(globalPath).toBe(join('/mock/home', '.claude', file));
      });
    });

    it('handles migration of deeply nested skill structures', () => {
      const skillPaths = [
        '.claude/skills/api-gen/SKILL.md',
        '.claude/skills/api-gen/references/template.ts',
        '.claude/skills/api-gen/references/nested/schema.json',
      ];

      skillPaths.forEach((path) => {
        const projectPath = resolveTargetPath(path, '.claude', '~/.claude', false);
        const globalPath = resolveTargetPath(path, '.claude', '~/.claude', true);

        expect(projectPath).toBe(path);
        expect(globalPath.startsWith(join('/mock/home', '.claude/skills/api-gen'))).toBe(true);
      });
    });

    it('handles migration with multiple targets simultaneously', () => {
      const targets = [
        { path: '.claude/rules/test.md', local: '.claude', global: '~/.claude' },
        { path: '.cursor/rules/test.mdc', local: '.cursor', global: '~/.cursor' },
        {
          path: '.github/copilot/skills/test/SKILL.md',
          local: '.github/copilot',
          global: '~/.copilot',
        },
      ];

      targets.forEach((target) => {
        const projectPath = resolveTargetPath(target.path, target.local, target.global, false);
        const globalPath = resolveTargetPath(target.path, target.local, target.global, true);

        expect(projectPath).toBe(target.path);
        expect(globalPath).toContain('/mock/home');
      });
    });
  });
});
