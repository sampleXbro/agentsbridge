import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { generate } from '../../../../src/core/generate/engine.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import {
  findGeneratedFile,
  validateSkillMd,
  validateNoCanonicalPaths,
} from '../validation-helpers.js';

const TEST_DIR = join(tmpdir(), 'am-cursor-global-structure-test');

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
    targets: ['cursor'],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'permissions', 'hooks', 'ignore'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

describe('cursor global mode structure validation', () => {
  describe('Global rules generation', () => {
    it('generates rules in home', async () => {
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
        ],
      });

      const files = await generate({
        config: makeConfig(),
        canonical,
        projectRoot: TEST_DIR,
        scope: 'global',
      });

      const ruleFile = findGeneratedFile(files, { stringContaining: '.cursor/rules/general.mdc' });
      expect(ruleFile).toBeDefined();
      expect(ruleFile.content).toContain('Global Rules');
      validateNoCanonicalPaths(ruleFile.content);
    });
  });

  describe('Global skills generation', () => {
    it('generates skills in correct directory', async () => {
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

      const skillFile = findGeneratedFile(files, { stringContaining: 'skills/api-gen/SKILL.md' });
      expect(skillFile).toBeDefined();
      validateSkillMd(skillFile.content);
      validateNoCanonicalPaths(skillFile.content);
    });
  });

  describe('Global MCP generation', () => {
    it('generates MCP config', async () => {
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

      const mcpFile = findGeneratedFile(files, { stringContaining: '.cursor/mcp.json' });
      expect(mcpFile).toBeDefined();
      validateNoCanonicalPaths(mcpFile.content);
    });
  });
});
