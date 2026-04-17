import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateSkills,
  generateMcp,
  generateHooks,
  generateIgnore,
} from '../../../../src/targets/kiro/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  validateMcpJson,
  validateSkillMd,
  validateNoCanonicalPaths,
} from '../validation-helpers.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('Kiro structure validation', () => {
  describe('generateRules', () => {
    it('generates AGENTS.md for root rule', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: 'Root',
            globs: [],
            body: '# Rules\nUse TypeScript.',
          },
        ],
      });

      const files = generateRules(canonical);
      const agentsMd = files.find((f) => f.path === 'AGENTS.md');
      expect(agentsMd).toBeDefined();
      validateNoCanonicalPaths(agentsMd!.content);
    });

    it('generates .kiro/steering/*.md for non-root rules', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/typescript.md',
            root: false,
            targets: [],
            description: 'TS',
            globs: [],
            body: 'Use strict.',
          },
        ],
      });

      const files = generateRules(canonical);
      const ruleFile = files.find((f) => f.path.startsWith('.kiro/steering/'));
      expect(ruleFile).toBeDefined();
      validateNoCanonicalPaths(ruleFile!.content);
    });
  });

  describe('generateSkills', () => {
    it('generates skill files', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/test/SKILL.md',
            name: 'test',
            description: 'Test',
            body: '# Test',
            supportingFiles: [],
          },
        ],
      });

      const files = generateSkills(canonical);
      const skillFile = files.find((f) => f.path.endsWith('SKILL.md'));
      expect(skillFile).toBeDefined();
      validateSkillMd(skillFile!.content);
      validateNoCanonicalPaths(skillFile!.content);
    });
  });

  describe('generateMcp', () => {
    it('generates .kiro/settings/mcp.json', () => {
      const canonical = makeCanonical({
        mcp: {
          mcpServers: {
            fs: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              env: {},
            },
          },
        },
      });

      const files = generateMcp(canonical);

      if (files.length > 0) {
        validateMcpJson(files[0]!.content);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });

  describe('generateHooks', () => {
    it('generates hook files', () => {
      const canonical = makeCanonical({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              command: 'prettier --write $FILE_PATH',
              type: 'command' as const,
            },
          ],
        },
      });

      const files = generateHooks(canonical);

      if (files.length > 0) {
        expect(files[0]!.path).toMatch(/\.kiro\.hook$/);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });

  describe('generateIgnore', () => {
    it('generates .kiroignore', () => {
      const canonical = makeCanonical({
        ignore: ['node_modules'],
      });

      const files = generateIgnore(canonical);

      if (files.length > 0) {
        expect(files[0]!.content).toContain('node_modules');
      }
    });
  });
});
