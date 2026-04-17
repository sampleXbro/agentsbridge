import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateSettings,
  generateIgnore,
} from '../../../../src/targets/gemini-cli/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
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

describe('Gemini CLI structure validation', () => {
  describe('generateRules', () => {
    it('generates GEMINI.md for root rule', () => {
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
      const geminiMd = files.find((f) => f.path === 'GEMINI.md');
      expect(geminiMd).toBeDefined();
      expect(geminiMd!.content).toContain('Use TypeScript');
      validateNoCanonicalPaths(geminiMd!.content);
    });
  });

  describe('generateCommands', () => {
    it('generates .gemini/commands/*.toml', () => {
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
        expect(file.path).toMatch(/\.toml$/);
        validateNoCanonicalPaths(file.content);
      }
    });
  });

  describe('generateAgents', () => {
    it('generates .gemini/agents/*.md with frontmatter', () => {
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
    it('generates .gemini/skills/{name}/SKILL.md', () => {
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

  describe('generateSettings', () => {
    it('generates .gemini/settings.json', () => {
      const canonical = makeCanonical({
        permissions: {
          allow: ['Read'],
          deny: [],
        },
      });

      const files = generateSettings(canonical);

      if (files.length > 0) {
        validateSettingsJson(files[0]!.content);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });

  describe('generateIgnore', () => {
    it('generates .geminiignore', () => {
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
