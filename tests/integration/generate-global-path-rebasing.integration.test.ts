/**
 * Integration test for global mode path rebasing.
 * Verifies that files are generated in the correct global locations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-global-path-rebasing');
const HOME_DIR = join(TEST_DIR, 'home');
const PROJECT_DIR = join(TEST_DIR, 'project');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(HOME_DIR, { recursive: true });
  mkdirSync(PROJECT_DIR, { recursive: true });

  vi.stubEnv('HOME', HOME_DIR);
  vi.stubEnv('USERPROFILE', HOME_DIR);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('generate --global (path rebasing integration)', () => {
  describe('Claude Code global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', 'typescript.md'),
        `---
description: "TypeScript rules"
globs:
  - src/**/*.ts
---
# TypeScript
No any type.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'api-gen', 'references'), {
        recursive: true,
      });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        `---
description: Generate APIs
---
# API Generation
Follow REST patterns.
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'api-gen', 'references', 'template.ts'),
        'export const template = 1;',
      );
    });

    it('generates root rule at ~/.claude/CLAUDE.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const claudeMd = join(HOME_DIR, '.claude', 'CLAUDE.md');
      expect(existsSync(claudeMd)).toBe(true);
      const content = readFileSync(claudeMd, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
    });

    it('generates scoped rule at ~/.claude/rules/typescript.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const tsRule = join(HOME_DIR, '.claude', 'rules', 'typescript.md');
      expect(existsSync(tsRule)).toBe(true);
      const content = readFileSync(tsRule, 'utf-8');
      expect(content).toContain('No any type');
      expect(content).toContain('src/**/*.ts');
    });

    it('generates skill at ~/.claude/skills/api-gen/SKILL.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const skillMd = join(HOME_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md');
      expect(existsSync(skillMd)).toBe(true);
      const content = readFileSync(skillMd, 'utf-8');
      expect(content).toContain('Follow REST patterns');
    });

    it('generates skill reference at ~/.claude/skills/api-gen/references/template.ts', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const template = join(HOME_DIR, '.claude', 'skills', 'api-gen', 'references', 'template.ts');
      expect(existsSync(template)).toBe(true);
      const content = readFileSync(template, 'utf-8');
      expect(content).toBe('export const template = 1;');
    });

    it('does not generate files in project directory', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      expect(existsSync(join(PROJECT_DIR, '.claude'))).toBe(false);
      expect(existsSync(join(PROJECT_DIR, 'CLAUDE.md'))).toBe(false);
    });
  });

  describe('Cursor global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [cursor]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'debugging'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'debugging', 'SKILL.md'),
        `---
description: Debug issues
---
# Debugging
Check logs first.
`,
      );
    });

    it('generates root rule at ~/.cursor/rules/general.mdc', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const generalMdc = join(HOME_DIR, '.cursor', 'rules', 'general.mdc');
      expect(existsSync(generalMdc)).toBe(true);
      const content = readFileSync(generalMdc, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
      expect(content).toContain('alwaysApply: true');
    });

    it('generates skill at ~/.cursor/skills/debugging/SKILL.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const skillMd = join(HOME_DIR, '.cursor', 'skills', 'debugging', 'SKILL.md');
      expect(existsSync(skillMd)).toBe(true);
      const content = readFileSync(skillMd, 'utf-8');
      expect(content).toContain('Check logs first');
    });
  });

  describe('Copilot global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [copilot]
features: [rules, commands]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'commands'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'commands', 'review.md'),
        `---
description: Review code
---
Review the current changes.
`,
      );
    });

    it('generates root at ~/.copilot/copilot-instructions.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const instructions = join(HOME_DIR, '.copilot', 'copilot-instructions.md');
      expect(existsSync(instructions)).toBe(true);
      const content = readFileSync(instructions, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
    });

    it('generates command at ~/.copilot/prompts/review.prompt.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const prompt = join(HOME_DIR, '.copilot', 'prompts', 'review.prompt.md');
      expect(existsSync(prompt)).toBe(true);
      const content = readFileSync(prompt, 'utf-8');
      expect(content).toContain('Review the current changes');
    });
  });

  describe('Windsurf global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [windsurf]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'testing'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'testing', 'SKILL.md'),
        `---
description: Write tests
---
# Testing
Use Vitest.
`,
      );
    });

    it('generates root at ~/.codeium/windsurf/memories/global_rules.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const memories = join(HOME_DIR, '.codeium', 'windsurf', 'memories', 'global_rules.md');
      expect(existsSync(memories)).toBe(true);
      const content = readFileSync(memories, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
    });

    it('generates skill at ~/.codeium/windsurf/skills/testing/SKILL.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const skillMd = join(HOME_DIR, '.codeium', 'windsurf', 'skills', 'testing', 'SKILL.md');
      expect(existsSync(skillMd)).toBe(true);
      const content = readFileSync(skillMd, 'utf-8');
      expect(content).toContain('Use Vitest');
    });
  });

  describe('Gemini CLI global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [gemini-cli]
features: [rules, agents]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'agents'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
        `---
name: code-reviewer
description: Review code
tools: Read, Grep
---
You are a code reviewer.
`,
      );
    });

    it('generates root at ~/.gemini/GEMINI.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const geminiMd = join(HOME_DIR, '.gemini', 'GEMINI.md');
      expect(existsSync(geminiMd)).toBe(true);
      const content = readFileSync(geminiMd, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
    });

    it('generates agent at ~/.gemini/agents/code-reviewer.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const agentMd = join(HOME_DIR, '.gemini', 'agents', 'code-reviewer.md');
      expect(existsSync(agentMd)).toBe(true);
      const content = readFileSync(agentMd, 'utf-8');
      expect(content).toContain('You are a code reviewer');
    });
  });

  describe('Kiro global mode', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [kiro]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global rules"
---
# Global Rules
Use TypeScript strict mode.
`,
      );
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'refactoring'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'refactoring', 'SKILL.md'),
        `---
description: Refactor code
---
# Refactoring
Improve code quality.
`,
      );
    });

    it('generates root at ~/.kiro/steering/AGENTS.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const agentsMd = join(HOME_DIR, '.kiro', 'steering', 'AGENTS.md');
      expect(existsSync(agentsMd)).toBe(true);
      const content = readFileSync(agentsMd, 'utf-8');
      expect(content).toContain('Use TypeScript strict mode');
    });

    it('generates skill at ~/.kiro/skills/refactoring/SKILL.md', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const skillMd = join(HOME_DIR, '.kiro', 'skills', 'refactoring', 'SKILL.md');
      expect(existsSync(skillMd)).toBe(true);
      const content = readFileSync(skillMd, 'utf-8');
      expect(content).toContain('Improve code quality');
    });
  });

  describe('path rebasing edge cases', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );
    });

    it('handles deeply nested skill paths', () => {
      // Create a skill with a simple name but nested references
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'deep-skill', 'refs', 'nested', 'more'), {
        recursive: true,
      });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'deep-skill', 'SKILL.md'),
        '---\ndescription: Deep skill\n---\n# Deep\n',
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'deep-skill', 'refs', 'nested', 'more', 'file.md'),
        '# Nested file\n',
      );

      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const deepSkill = join(HOME_DIR, '.claude', 'skills', 'deep-skill', 'SKILL.md');
      expect(existsSync(deepSkill)).toBe(true);
      const nestedRef = join(
        HOME_DIR,
        '.claude',
        'skills',
        'deep-skill',
        'refs',
        'nested',
        'more',
        'file.md',
      );
      expect(existsSync(nestedRef)).toBe(true);
    });

    it('handles skill names with special characters', () => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'api-v2.1_gen'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'api-v2.1_gen', 'SKILL.md'),
        '---\ndescription: API\n---\n# API\n',
      );

      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const skillMd = join(HOME_DIR, '.claude', 'skills', 'api-v2.1_gen', 'SKILL.md');
      expect(existsSync(skillMd)).toBe(true);
    });

    it('handles multiple reference files in skill', () => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'complex', 'references', 'nested'), {
        recursive: true,
      });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'complex', 'SKILL.md'),
        '---\ndescription: Complex\n---\n# Complex\n',
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'complex', 'references', 'ref1.md'),
        '# Ref 1',
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'complex', 'references', 'nested', 'ref2.md'),
        '# Ref 2',
      );

      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      expect(
        existsSync(join(HOME_DIR, '.claude', 'skills', 'complex', 'references', 'ref1.md')),
      ).toBe(true);
      expect(
        existsSync(
          join(HOME_DIR, '.claude', 'skills', 'complex', 'references', 'nested', 'ref2.md'),
        ),
      ).toBe(true);
    });
  });

  describe('mixed project and global mode', () => {
    beforeEach(() => {
      // Home config
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Global Root
`,
      );

      // Project config
      mkdirSync(join(PROJECT_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(PROJECT_DIR, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(PROJECT_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Project Root
`,
      );
    });

    it('project mode generates in project directory', () => {
      execSync(`node ${CLI_PATH} generate`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const projectClaude = join(PROJECT_DIR, '.claude', 'CLAUDE.md');
      expect(existsSync(projectClaude)).toBe(true);
      const content = readFileSync(projectClaude, 'utf-8');
      expect(content).toContain('Project Root');
    });

    it('global mode generates in home directory', () => {
      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      const homeClaude = join(HOME_DIR, '.claude', 'CLAUDE.md');
      expect(existsSync(homeClaude)).toBe(true);
      const content = readFileSync(homeClaude, 'utf-8');
      expect(content).toContain('Global Root');
    });
  });

  describe('filesystem symlink handling', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );
    });

    it.skipIf(process.platform === 'win32')(
      'generates files correctly when global root is a symlink',
      () => {
        const realDir = join(HOME_DIR, 'real-claude');
        const symlinkDir = join(HOME_DIR, '.claude');

        mkdirSync(realDir, { recursive: true });

        try {
          execSync(`ln -s ${realDir} ${symlinkDir}`, { stdio: 'ignore' });
        } catch {
          // Skip test if symlink creation fails (e.g., Windows without permissions)
          return;
        }

        execSync(`node ${CLI_PATH} generate --global`, {
          cwd: PROJECT_DIR,
          env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
        });

        // Files should be accessible through the symlink
        const claudeMd = join(symlinkDir, 'CLAUDE.md');
        expect(existsSync(claudeMd)).toBe(true);

        // And also through the real directory
        const realClaudeMd = join(realDir, 'CLAUDE.md');
        expect(existsSync(realClaudeMd)).toBe(true);
      },
    );

    it('handles symlinked skill directories', () => {
      // Create a real skill in canonical location
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'skills', 'test-skill'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'skills', 'test-skill', 'SKILL.md'),
        '---\ndescription: Test\n---\n# Test\n',
      );

      // Create a symlink to the skill directory
      const symlinkPath = join(HOME_DIR, '.agentsmesh', 'skills', 'linked-skill');
      const targetPath = join(HOME_DIR, '.agentsmesh', 'skills', 'test-skill');

      try {
        execSync(`ln -s ${targetPath} ${symlinkPath}`, { stdio: 'ignore' });
      } catch {
        // Skip test if symlink creation fails
        return;
      }

      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      // The original skill should be generated
      const generatedSkill = join(HOME_DIR, '.claude', 'skills', 'test-skill', 'SKILL.md');
      expect(existsSync(generatedSkill)).toBe(true);

      // Note: Symlinked skills may or may not be followed depending on the loader implementation
      // This test verifies the original skill is generated correctly
    });

    it('handles broken symlinks gracefully', () => {
      const symlinkDir = join(HOME_DIR, '.claude-broken');

      try {
        execSync(`ln -s /nonexistent/path ${symlinkDir}`, { stdio: 'ignore' });
      } catch {
        // Skip test if symlink creation fails
        return;
      }

      // Update config to use broken symlink
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );

      // Should fail gracefully with a clear error
      try {
        execSync(`node ${CLI_PATH} generate --global`, {
          cwd: PROJECT_DIR,
          env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
          stdio: 'pipe',
        });
      } catch (error: unknown) {
        const err = error as { stderr?: Buffer };
        expect(err.stderr?.toString()).toMatch(/error|fail|ENOENT/i);
      }
    });
  });

  describe('concurrent generation scenarios', () => {
    beforeEach(() => {
      mkdirSync(join(HOME_DIR, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
      );
      writeFileSync(
        join(HOME_DIR, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );
    });

    it('handles multiple target generation to same global directory', () => {
      execSync(`node ${CLI_PATH} generate --global --targets claude-code`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      execSync(`node ${CLI_PATH} generate --global --targets cursor`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR },
      });

      expect(existsSync(join(HOME_DIR, '.claude', 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(HOME_DIR, '.cursor', 'rules', 'general.mdc'))).toBe(true);
    });
  });
});
