import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { generate } from '../../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import {
  findGeneratedFile,
  validateMcpJson,
  validateSkillMd,
  validateNoCanonicalPaths,
} from '../validation-helpers.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-global-structure-test');

function setupTestDir(): void {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

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

function makeConfig(overrides: Partial<ValidatedConfig> = {}): ValidatedConfig {
  return {
    version: 1,
    targets: ['antigravity'],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'permissions', 'hooks', 'ignore'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

describe('Antigravity global mode structure validation', () => {
  describe('Global rules generation', () => {
    it('generates aggregate GEMINI.md in .gemini/antigravity/', async () => {
      setupTestDir();
      const canonical = makeCanonical({
        rules: [
          {
            source: join(TEST_DIR, '.agentsmesh/rules/_root.md'),
            root: true,
            targets: [],
            description: 'Root rules',
            globs: [],
            body: '# Global Rules\n\nUse TypeScript.',
          },
          {
            source: join(TEST_DIR, '.agentsmesh/rules/typescript.md'),
            root: false,
            targets: [],
            description: 'TypeScript rules',
            globs: ['**/*.ts'],
            body: 'Use strict mode.',
          },
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const geminiFile = findGeneratedFile(files, '.gemini/antigravity/GEMINI.md');
      expect(geminiFile).toBeDefined();
      expect(geminiFile.content).toContain('Global Rules');
      expect(geminiFile.content).toContain('Use strict mode');
      validateNoCanonicalPaths(geminiFile.content);

      const individualRules = files.filter(
        (f) =>
          f.path.includes('.gemini/antigravity/') &&
          f.path !== '.gemini/antigravity/GEMINI.md' &&
          f.path.endsWith('.md') &&
          !f.path.includes('skills/') &&
          !f.path.includes('workflows/'),
      );
      expect(individualRules.length).toBe(0);
    });
  });

  describe('Global workflows generation', () => {
    it('generates workflows in .gemini/antigravity/workflows/', async () => {
      setupTestDir();
      const canonical = makeCanonical({
        commands: [
          {
            source: join(TEST_DIR, '.agentsmesh/commands/test.md'),
            name: 'test',
            description: 'Run tests',
            allowedTools: ['Bash'],
            body: 'Run the test suite.',
          },
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const workflowFile = findGeneratedFile(files, {
        stringContaining: '.gemini/antigravity/workflows/test.md',
      });
      expect(workflowFile).toBeDefined();
      expect(workflowFile.content).toContain('Run the test suite');
      validateNoCanonicalPaths(workflowFile.content);
    });
  });

  describe('Global skills generation', () => {
    it('generates skills in .gemini/antigravity/skills/', async () => {
      setupTestDir();
      const canonical = makeCanonical({
        skills: [
          {
            source: join(TEST_DIR, '.agentsmesh/skills/api-gen/SKILL.md'),
            name: 'api-gen',
            description: 'Generate APIs',
            body: '# API Generation\n\nCreate REST APIs.',
            supportingFiles: [],
          },
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const skillFile = findGeneratedFile(files, {
        stringContaining: '.gemini/antigravity/skills/api-gen/SKILL.md',
      });
      expect(skillFile).toBeDefined();
      validateSkillMd(skillFile.content);
      validateNoCanonicalPaths(skillFile.content);
    });

    it('generates supporting files with correct paths', async () => {
      setupTestDir();
      const canonical = makeCanonical({
        skills: [
          {
            source: join(TEST_DIR, '.agentsmesh/skills/test-skill/SKILL.md'),
            name: 'test-skill',
            description: 'Test',
            body: 'Main content',
            supportingFiles: [
              {
                relativePath: 'references/guide.md',
                absolutePath: join(TEST_DIR, '.agentsmesh/skills/test-skill/references/guide.md'),
                content: '# Guide',
              },
            ],
          },
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const supportFile = findGeneratedFile(files, {
        stringContaining: '.gemini/antigravity/skills/test-skill/references/guide.md',
      });
      expect(supportFile).toBeDefined();
      expect(supportFile.content).toBe('# Guide');
    });
  });

  describe('Global MCP generation', () => {
    it('generates MCP config in .gemini/antigravity/', async () => {
      setupTestDir();
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

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const mcpFile = findGeneratedFile(files, {
        stringContaining: '.gemini/antigravity/mcp_config.json',
      });
      expect(mcpFile).toBeDefined();
      validateMcpJson(mcpFile.content);
      validateNoCanonicalPaths(mcpFile.content);
    });
  });

  describe('Global mode does NOT generate agents', () => {
    it('suppresses agent generation in global mode', async () => {
      setupTestDir();
      const canonical = makeCanonical({
        agents: [
          {
            source: join(TEST_DIR, '.agentsmesh/agents/reviewer.md'),
            name: 'reviewer',
            description: 'Code reviewer',
            tools: [],
            disallowedTools: [],
            model: '',
            permissionMode: '',
            maxTurns: 0,
            mcpServers: [],
            hooks: {},
            skills: [],
            memory: '',
            body: 'Review code',
          },
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const agentFiles = files.filter((f) => f.path.includes('agents/'));
      expect(agentFiles.length).toBe(0);
    });
  });
});
