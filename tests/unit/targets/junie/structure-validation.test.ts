import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateMcp,
  generateCommands,
  generateAgents,
  generateIgnore,
  generateSkills,
} from '../../../../src/targets/junie/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  validateMcpJson,
  validateSkillMd,
  validateAgentMd,
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

describe('Junie structure validation', () => {
  describe('generateRules', () => {
    it('generates JUNIE.md for root rule', () => {
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
      const junieMd = files.find((f) => f.path === '.junie/AGENTS.md');
      expect(junieMd).toBeDefined();
      validateNoCanonicalPaths(junieMd!.content);
    });

    it('generates .junie/rules/*.md for non-root rules', () => {
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
      const ruleFile = files.find((f) => f.path.startsWith('.junie/rules/'));
      expect(ruleFile).toBeDefined();
      validateNoCanonicalPaths(ruleFile!.content);
    });
  });

  describe('generateCommands', () => {
    it('generates command files', () => {
      const canonical = makeCanonical({
        commands: [
          {
            source: '/proj/.agentsmesh/commands/test.md',
            name: 'test',
            description: 'Test',
            allowedTools: [],
            body: 'Run tests.',
          },
        ],
      });

      const files = generateCommands(canonical);

      for (const file of files) {
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateAgents', () => {
    it('generates agent files', () => {
      const canonical = makeCanonical({
        agents: [
          {
            source: '/proj/.agentsmesh/agents/reviewer.md',
            name: 'reviewer',
            description: 'Reviewer',
            tools: [],
            disallowedTools: [],
            model: '',
            permissionMode: '',
            maxTurns: 0,
            mcpServers: [],
            hooks: {},
            skills: [],
            memory: '',
            body: 'You are a reviewer.',
          },
        ],
      });

      const files = generateAgents(canonical);

      for (const file of files) {
        validateAgentMd(file.content);
        validateNoCanonicalPaths(file.content);
      }
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
    it('generates MCP configuration', () => {
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

  describe('generateIgnore', () => {
    it('generates ignore file', () => {
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
