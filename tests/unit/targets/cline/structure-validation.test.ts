import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateWorkflows,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateHooks,
} from '../../../../src/targets/cline/generator.js';
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

describe('Cline structure validation', () => {
  describe('generateRules', () => {
    it('generates correct rule file structure', () => {
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
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateWorkflows', () => {
    it('generates workflow files with correct structure', () => {
      const canonical = makeCanonical({
        commands: [
          {
            source: '/proj/.agentsmesh/commands/test.md',
            name: 'test',
            description: 'Run tests',
            allowedTools: [],
            body: 'Run tests.',
          },
        ],
      });

      const files = generateWorkflows(canonical);

      for (const file of files) {
        expect(file.path).toMatch(/\.md$/);
        expect(file.path).toContain('workflows');
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateAgents', () => {
    it('generates agent files with valid structure', () => {
      const canonical = makeCanonical({
        agents: [
          {
            source: '/proj/.agentsmesh/agents/reviewer.md',
            name: 'reviewer',
            description: 'Reviewer',
            tools: ['Read'],
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
    it('generates skill files with SKILL.md', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/test/SKILL.md',
            name: 'test',
            description: 'Test skill',
            body: '# Test\nTest content.',
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
    it('generates valid MCP JSON', () => {
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
    it('generates hook scripts', () => {
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
        expect(files[0]!.path).toMatch(/\.sh$/);
        expect(files[0]!.content).toContain('#!/usr/bin/env bash');
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
