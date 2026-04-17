import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateWorkflows,
  generateSkills,
  generateMcp,
} from '../../../../src/targets/antigravity/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  validateFrontmatter,
  findGeneratedFile,
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

describe('Antigravity structure validation', () => {
  describe('generateRules', () => {
    it('generates correct file structure for root rule', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: 'Root rules',
            globs: [],
            body: '# Project Rules\n\nUse TypeScript.',
          },
        ],
      });

      const files = generateRules(canonical);
      expect(files.length).toBeGreaterThan(0);

      // Validate each generated file
      for (const file of files) {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
        validateNoCanonicalPaths(file.content);
      }
    });

    it('generates correct file structure for non-root rules', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/typescript.md',
            root: false,
            targets: [],
            description: 'TypeScript rules',
            globs: ['**/*.ts'],
            body: 'Use strict mode.',
          },
        ],
      });

      const files = generateRules(canonical);

      for (const file of files) {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
        validateNoCanonicalPaths(file.content);

        // Validate frontmatter if present
        const { frontmatter } = validateFrontmatter(file.content);
        if (frontmatter) {
          expect(typeof frontmatter).toBe('object');
        }
      }
    });
  });

  describe('generateWorkflows', () => {
    it('generates correct workflow file structure', () => {
      const canonical = makeCanonical({
        commands: [
          {
            source: '/proj/.agentsmesh/commands/test.md',
            name: 'test',
            description: 'Run tests',
            allowedTools: ['Bash'],
            body: 'Run the test suite.',
          },
        ],
      });

      const files = generateWorkflows(canonical);

      for (const file of files) {
        expect(file.path).toMatch(/\.md$/);
        expect(file.content).toBeTruthy();
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateSkills', () => {
    it('generates correct skill file structure', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/api-gen/SKILL.md',
            name: 'api-gen',
            description: 'Generate APIs',
            body: '# API Generation\n\nCreate REST APIs.',
            supportingFiles: [],
          },
        ],
      });

      const files = generateSkills(canonical);

      const skillFile = findGeneratedFile(files, { stringContaining: 'SKILL.md' });
      validateSkillMd(skillFile.content);
      validateNoCanonicalPaths(skillFile.content);
    });

    it('generates supporting files with correct paths', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/test-skill/SKILL.md',
            name: 'test-skill',
            description: 'Test',
            body: 'Main content',
            supportingFiles: [
              {
                relativePath: 'references/guide.md',
                absolutePath: '/proj/.agentsmesh/skills/test-skill/references/guide.md',
                content: '# Guide',
              },
            ],
          },
        ],
      });

      const files = generateSkills(canonical);
      expect(files.length).toBeGreaterThanOrEqual(2);

      const supportFile = files.find((f) => f.path.includes('references/guide.md'));
      expect(supportFile).toBeDefined();
      expect(supportFile!.content).toBe('# Guide');
    });
  });

  describe('generateMcp', () => {
    it('generates valid MCP JSON structure', () => {
      const canonical = makeCanonical({
        mcp: {
          mcpServers: {
            filesystem: {
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
        const mcpFile = files[0]!;
        validateMcpJson(mcpFile.content);
        validateNoCanonicalPaths(mcpFile.content);
      }
    });
  });
});
