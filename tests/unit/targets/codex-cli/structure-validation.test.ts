import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
} from '../../../../src/targets/codex-cli/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { validateSkillMd, validateNoCanonicalPaths } from '../validation-helpers.js';

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

describe('Codex CLI structure validation', () => {
  describe('generateRules', () => {
    it('generates .codex/instructions/*.md files', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/typescript.md',
            root: false,
            targets: [],
            description: 'TS rules',
            globs: [],
            body: 'Use strict mode.',
          },
        ],
      });

      const files = generateRules(canonical);

      for (const file of files) {
        expect(file.path).toMatch(/\.md$/);
        validateNoCanonicalPaths(file.content);
      }
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
    it('generates agent TOML files', () => {
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
        // Codex uses TOML for agents
        expect(file.path).toMatch(/\.toml$/);
        expect(file.content).toContain('name =');
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateSkills', () => {
    it('generates skill directories with SKILL.md', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/test/SKILL.md',
            name: 'test',
            description: 'Test',
            body: '# Test skill',
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
    it('generates MCP configuration in TOML format', () => {
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
        // Codex uses TOML for MCP config
        expect(files[0]!.path).toMatch(/\.toml$/);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });

  describe('generateMcp', () => {
    it('generates MCP configuration in config.toml', () => {
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
        expect(files[0]!.path).toMatch(/config\.toml$/);
        expect(files[0]!.content).toContain('[mcp_servers.');
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });
});
