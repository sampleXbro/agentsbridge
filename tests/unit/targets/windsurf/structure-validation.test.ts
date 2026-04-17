import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateIgnore,
  generateWorkflows,
  generateAgents,
  generateMcp,
  generateSkills,
} from '../../../../src/targets/windsurf/generator.js';
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

describe('Windsurf structure validation', () => {
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
  });

  describe('generateWorkflows', () => {
    it('generates workflow files', () => {
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

      const files = generateWorkflows(canonical);

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
