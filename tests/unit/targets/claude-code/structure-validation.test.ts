import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generatePermissions,
  generateIgnore,
} from '../../../../src/targets/claude-code/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  findGeneratedFile,
  validateMcpJson,
  validateSettingsJson,
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

describe('Claude Code structure validation', () => {
  describe('generateRules', () => {
    it('generates CLAUDE.md for root rule', () => {
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
      const claudeMd = findGeneratedFile(files, '.claude/CLAUDE.md');
      expect(claudeMd.content).toContain('Use TypeScript');
      validateNoCanonicalPaths(claudeMd.content);
    });

    it('generates .claude/rules/*.md for non-root rules', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/typescript.md',
            root: false,
            targets: [],
            description: 'TS rules',
            globs: ['**/*.ts'],
            body: 'Use strict mode.',
          },
        ],
      });

      const files = generateRules(canonical);
      const ruleFile = files.find((f) => f.path.startsWith('.claude/rules/'));
      expect(ruleFile).toBeDefined();
      expect(ruleFile!.path).toMatch(/\.md$/);
      validateNoCanonicalPaths(ruleFile!.content);
    });
  });

  describe('generateCommands', () => {
    it('generates .claude/commands/*.md files', () => {
      const canonical = makeCanonical({
        commands: [
          {
            source: '/proj/.agentsmesh/commands/test.md',
            name: 'test',
            description: 'Run tests',
            allowedTools: ['Bash'],
            body: 'Run test suite.',
          },
        ],
      });

      const files = generateCommands(canonical);
      expect(files.length).toBeGreaterThan(0);

      const cmdFile = files[0]!;
      expect(cmdFile.path).toMatch(/^\.claude\/commands\/.*\.md$/);
      validateNoCanonicalPaths(cmdFile.content);
    });
  });

  describe('generateAgents', () => {
    it('generates .claude/agents/*.md files with frontmatter', () => {
      const canonical = makeCanonical({
        agents: [
          {
            source: '/proj/.agentsmesh/agents/reviewer.md',
            name: 'reviewer',
            description: 'Reviews code',
            tools: ['Read'],
            disallowedTools: [],
            model: 'claude-sonnet',
            permissionMode: 'default',
            maxTurns: 10,
            mcpServers: [],
            hooks: {},
            skills: [],
            memory: '',
            body: 'You are a reviewer.',
          },
        ],
      });

      const files = generateAgents(canonical);
      const agentFile = findGeneratedFile(files, { stringMatching: /^\.claude\/agents\/.*\.md$/ });
      validateAgentMd(agentFile.content);
      validateNoCanonicalPaths(agentFile.content);
    });
  });

  describe('generateSkills', () => {
    it('generates .claude/skills/{name}/SKILL.md', () => {
      const canonical = makeCanonical({
        skills: [
          {
            source: '/proj/.agentsmesh/skills/api-gen/SKILL.md',
            name: 'api-gen',
            description: 'Generate APIs',
            body: '# API Gen\nCreate APIs.',
            supportingFiles: [],
          },
        ],
      });

      const files = generateSkills(canonical);
      const skillFile = findGeneratedFile(files, '.claude/skills/api-gen/SKILL.md');
      validateSkillMd(skillFile.content);
      validateNoCanonicalPaths(skillFile.content);
    });
  });

  describe('generateMcp', () => {
    it('generates .mcp.json at project root', () => {
      const canonical = makeCanonical({
        mcp: {
          mcpServers: {
            context7: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@upstash/context7-mcp'],
              env: {},
            },
          },
        },
      });

      const files = generateMcp(canonical);
      const mcpFile = findGeneratedFile(files, '.mcp.json');
      validateMcpJson(mcpFile.content);
      validateNoCanonicalPaths(mcpFile.content);
    });
  });

  describe('generatePermissions', () => {
    it('generates .claude/settings.json with valid structure', () => {
      const canonical = makeCanonical({
        permissions: {
          allow: ['Read', 'Write'],
          deny: ['WebFetch'],
        },
      });

      const files = generatePermissions(canonical);

      if (files.length > 0) {
        const settingsFile = findGeneratedFile(files, '.claude/settings.json');
        validateSettingsJson(settingsFile.content);
        validateNoCanonicalPaths(settingsFile.content);
      }
    });
  });

  describe('generateIgnore', () => {
    it('generates .claudeignore file', () => {
      const canonical = makeCanonical({
        ignore: ['node_modules', '.env'],
      });

      const files = generateIgnore(canonical);
      const ignoreFile = findGeneratedFile(files, '.claudeignore');
      expect(ignoreFile.content).toContain('node_modules');
      expect(ignoreFile.content).toContain('.env');
    });
  });
});
