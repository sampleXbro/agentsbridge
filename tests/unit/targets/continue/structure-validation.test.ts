import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateMcp,
} from '../../../../src/targets/continue/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { validateJsonStructure, validateNoCanonicalPaths } from '../validation-helpers.js';

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

describe('Continue structure validation', () => {
  describe('generateRules', () => {
    it('generates .continuerc.json with rules', () => {
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

  describe('generateCommands', () => {
    it('generates slash commands in config', () => {
      const canonical = makeCanonical({
        commands: [
          {
            source: '/proj/.agentsmesh/commands/test.md',
            name: 'test',
            description: 'Run tests',
            allowedTools: [],
            body: 'Run test suite.',
          },
        ],
      });

      const files = generateCommands(canonical);

      for (const file of files) {
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateSkills', () => {
    it('generates embedded skills', () => {
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

      for (const file of files) {
        validateNoCanonicalPaths(file.content);
        expect(file.path).toContain('SKILL.md');
      }
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
        validateJsonStructure(files[0]!.content, ['mcpServers']);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });
});
