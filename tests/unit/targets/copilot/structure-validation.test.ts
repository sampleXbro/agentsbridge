import { describe, it, expect } from 'vitest';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateHooks,
} from '../../../../src/targets/copilot/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  validateHooksJson,
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

describe('Copilot structure validation', () => {
  describe('generateRules', () => {
    it('generates .github/copilot-instructions.md for root rule', () => {
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
      const instructionsMd = files.find((f) => f.path === '.github/copilot-instructions.md');
      expect(instructionsMd).toBeDefined();
      validateNoCanonicalPaths(instructionsMd!.content);
    });

    it('generates .github/instructions/*.instructions.md for non-root rules with globs', () => {
      const canonical = makeCanonical({
        rules: [
          {
            source: '/proj/.agentsmesh/rules/typescript.md',
            root: false,
            targets: [],
            description: 'TS',
            globs: ['**/*.ts'],
            body: 'Use strict.',
          },
        ],
      });

      const files = generateRules(canonical);
      const ruleFile = files.find((f) => f.path.startsWith('.github/instructions/'));
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

  describe('generateHooks', () => {
    it('generates hooks.json', () => {
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
        validateHooksJson(files[0]!.content);
        validateNoCanonicalPaths(files[0]!.content);
      }
    });
  });
});
