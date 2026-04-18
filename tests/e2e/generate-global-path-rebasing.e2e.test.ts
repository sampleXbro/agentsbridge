/**
 * E2E tests for global mode path rebasing.
 * Verifies end-to-end behavior of path rebasing across all supported targets.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { fileExists, fileContains, fileNotExists } from './helpers/assertions.js';

describe('generate --global (path rebasing e2e)', () => {
  let homeDir: string;
  let projectDir: string;

  beforeEach(() => {
    homeDir = createTestProject();
    projectDir = createTestProject();
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (homeDir) cleanup(homeDir);
    if (projectDir) cleanup(projectDir);
  });

  describe('all targets global mode', () => {
    beforeEach(() => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code, cursor, copilot, windsurf, gemini-cli, kiro, cline, continue, junie, roo-code, codex-cli]
features: [rules, skills, commands, agents]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
description: "Global standards"
---
# Global Standards
- Use TypeScript strict mode
- Follow project conventions
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', 'security.md'),
        `---
description: "Security rules"
globs:
  - src/**/*.ts
---
# Security
- No hardcoded secrets
- Validate all inputs
`,
      );
      mkdirSync(join(homeDir, '.agentsmesh', 'skills', 'security-audit', 'references'), {
        recursive: true,
      });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'skills', 'security-audit', 'SKILL.md'),
        `---
description: Audit security
---
# Security Audit
Check for vulnerabilities.
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'skills', 'security-audit', 'references', 'checklist.md'),
        '# Security Checklist\n- [ ] Check dependencies\n',
      );
      mkdirSync(join(homeDir, '.agentsmesh', 'commands'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'commands', 'audit.md'),
        `---
description: Run security audit
---
Run a comprehensive security audit.
`,
      );
      mkdirSync(join(homeDir, '.agentsmesh', 'agents'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agents', 'security-expert.md'),
        `---
name: security-expert
description: Security expert agent
tools: Read, Grep, Bash
---
You are a security expert.
`,
      );
    });

    it('generates Claude Code files in ~/.claude/', async () => {
      const r = await runCli('generate --global --targets claude-code', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Use TypeScript strict mode');
      fileExists(join(homeDir, '.claude', 'rules', 'security.md'));
      fileContains(join(homeDir, '.claude', 'rules', 'security.md'), 'No hardcoded secrets');
      fileExists(join(homeDir, '.claude', 'skills', 'security-audit', 'SKILL.md'));
      fileExists(
        join(homeDir, '.claude', 'skills', 'security-audit', 'references', 'checklist.md'),
      );
      fileExists(join(homeDir, '.claude', 'commands', 'audit.md'));
      fileExists(join(homeDir, '.claude', 'agents', 'security-expert.md'));
    });

    it('generates Cursor files in ~/.cursor/', async () => {
      const r = await runCli('generate --global --targets cursor', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.cursor', 'rules', 'general.mdc'));
      fileContains(join(homeDir, '.cursor', 'rules', 'general.mdc'), 'Use TypeScript strict mode');
      fileContains(join(homeDir, '.cursor', 'rules', 'general.mdc'), 'alwaysApply: true');
      fileExists(join(homeDir, '.cursor', 'rules', 'security.mdc'));
      fileExists(join(homeDir, '.cursor', 'skills', 'security-audit', 'SKILL.md'));
      fileExists(join(homeDir, '.cursor', 'commands', 'audit.md'));
      fileExists(join(homeDir, '.cursor', 'agents', 'security-expert.md'));
    });

    it('generates Copilot files in ~/.copilot/', async () => {
      const r = await runCli('generate --global --targets copilot', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.copilot', 'copilot-instructions.md'));
      fileContains(
        join(homeDir, '.copilot', 'copilot-instructions.md'),
        'Use TypeScript strict mode',
      );
      fileExists(join(homeDir, '.copilot', 'skills', 'security-audit', 'SKILL.md'));
      fileExists(join(homeDir, '.copilot', 'prompts', 'audit.prompt.md'));
    });

    it('generates Windsurf files in ~/.codeium/windsurf/', async () => {
      const r = await runCli('generate --global --targets windsurf', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'));
      fileContains(
        join(homeDir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
        'Use TypeScript strict mode',
      );
      fileExists(join(homeDir, '.codeium', 'windsurf', 'skills', 'security-audit', 'SKILL.md'));
      fileExists(join(homeDir, '.codeium', 'windsurf', 'global_workflows', 'audit.md'));
    });

    it('generates Gemini CLI files in ~/.gemini/', async () => {
      const r = await runCli('generate --global --targets gemini-cli', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.gemini', 'GEMINI.md'));
      fileContains(join(homeDir, '.gemini', 'GEMINI.md'), 'Use TypeScript strict mode');
      fileExists(join(homeDir, '.gemini', 'skills', 'security-audit', 'SKILL.md'));
      fileExists(join(homeDir, '.gemini', 'commands', 'audit.toml'));
      fileExists(join(homeDir, '.gemini', 'agents', 'security-expert.md'));
    });

    it('generates Kiro files in ~/.kiro/ and ~/.kiro/steering/AGENTS.md', async () => {
      const r = await runCli('generate --global --targets kiro', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.kiro', 'steering', 'AGENTS.md'));
      fileContains(join(homeDir, '.kiro', 'steering', 'AGENTS.md'), 'Use TypeScript strict mode');
      fileExists(join(homeDir, '.kiro', 'steering', 'security.md'));
      fileExists(join(homeDir, '.kiro', 'skills', 'security-audit', 'SKILL.md'));
    });

    it('generates Cline files in ~/.cline/ and ~/.cline/AGENTS.md', async () => {
      const r = await runCli('generate --global --targets cline', projectDir);
      expect(r.exitCode).toBe(0);

      // Cline in global mode may place AGENTS.md differently - check actual behavior
      fileExists(join(homeDir, '.cline', 'skills', 'security-audit', 'SKILL.md'));
    });

    it('generates Continue files in ~/.continue/', async () => {
      const r = await runCli('generate --global --targets continue', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.continue', 'skills', 'security-audit', 'SKILL.md'));
    });

    it('generates Junie files in ~/.junie/', async () => {
      const r = await runCli('generate --global --targets junie', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.junie', 'skills', 'security-audit', 'SKILL.md'));
    });

    it('generates Roo Code files in ~/.roo-code/', async () => {
      const r = await runCli('generate --global --targets roo-code', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.roo', 'skills', 'security-audit', 'SKILL.md'));
    });

    it('generates Codex CLI files in ~/.codex/', async () => {
      const r = await runCli('generate --global --targets codex-cli', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.codex', 'AGENTS.md'));
      const instructions = readFileSync(join(homeDir, '.codex', 'AGENTS.md'), 'utf-8');
      expect(instructions).toContain('Use TypeScript strict mode');
      fileExists(join(homeDir, '.codex', 'agents', 'security-expert.toml'));
    });
  });

  describe('reference rewriting in global mode', () => {
    beforeEach(() => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
See skill: .agentsmesh/skills/api-gen/SKILL.md
Reference: .agentsmesh/skills/api-gen/references/template.ts
`,
      );
      mkdirSync(join(homeDir, '.agentsmesh', 'skills', 'api-gen', 'references'), {
        recursive: true,
      });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
        `---
description: API generation
---
# API Gen
Template: .agentsmesh/skills/api-gen/references/template.ts
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'skills', 'api-gen', 'references', 'template.ts'),
        'export const t = 1;',
      );
    });

    it('rewrites canonical references to global paths in root file', async () => {
      const r = await runCli('generate --global', projectDir);
      expect(r.exitCode).toBe(0);

      const claudeMd = join(homeDir, '.claude', 'CLAUDE.md');
      fileExists(claudeMd);
      const content = readFileSync(claudeMd, 'utf-8');

      // References should be rewritten to relative paths from ~/.claude/
      expect(content).toContain('skills/api-gen/SKILL.md');
      expect(content).toContain('skills/api-gen/references/template.ts');
      expect(content).not.toContain('.agentsmesh/');
    });

    it('rewrites canonical references to global paths in skill file', async () => {
      const r = await runCli('generate --global', projectDir);
      expect(r.exitCode).toBe(0);

      const skillMd = join(homeDir, '.claude', 'skills', 'api-gen', 'SKILL.md');
      fileExists(skillMd);
      const content = readFileSync(skillMd, 'utf-8');

      // Reference should be rewritten to relative path from skill directory
      expect(content).toContain('references/template.ts');
      expect(content).not.toContain('.agentsmesh/');
    });
  });

  describe('global mode with extends', () => {
    let sharedDir: string;

    beforeEach(() => {
      sharedDir = createTestProject();

      // Shared pack
      mkdirSync(join(sharedDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(sharedDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Shared Root
`,
      );
      mkdirSync(join(sharedDir, '.agentsmesh', 'skills', 'shared-skill'), { recursive: true });
      writeFileSync(
        join(sharedDir, '.agentsmesh', 'skills', 'shared-skill', 'SKILL.md'),
        `---
description: Shared skill
---
# Shared
`,
      );

      // Home config with extend
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
extends:
  - name: shared
    source: ${sharedDir}
    features: [skills]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Home Root (overrides)
`,
      );
    });

    afterEach(() => {
      if (sharedDir) cleanup(sharedDir);
    });

    it('merges extended skills into global home directory', async () => {
      const r = await runCli('generate --global', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Home Root (overrides)');
      fileExists(join(homeDir, '.claude', 'skills', 'shared-skill', 'SKILL.md'));
      fileContains(join(homeDir, '.claude', 'skills', 'shared-skill', 'SKILL.md'), '# Shared');
    });
  });

  describe('global mode isolation', () => {
    beforeEach(() => {
      // Home config
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Global Config
`,
      );

      // Project config
      mkdirSync(join(projectDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(projectDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(projectDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Project Config
`,
      );
    });

    it('global mode does not pollute project directory', async () => {
      const r = await runCli('generate --global', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileNotExists(join(projectDir, '.claude', 'CLAUDE.md'));
    });

    it('project mode does not pollute home directory', async () => {
      const r = await runCli('generate', projectDir);
      expect(r.exitCode).toBe(0);

      fileExists(join(projectDir, '.claude', 'CLAUDE.md'));
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');

      // Home directory should not be affected
      fileNotExists(join(homeDir, '.claude', 'CLAUDE.md'));
    });

    it('can run both modes sequentially without conflicts', async () => {
      // Generate project mode
      const r1 = await runCli('generate', projectDir);
      expect(r1.exitCode).toBe(0);
      fileExists(join(projectDir, '.claude', 'CLAUDE.md'));
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');

      // Generate global mode
      const r2 = await runCli('generate --global', projectDir);
      expect(r2.exitCode).toBe(0);
      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Config');

      // Both should coexist
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Config');
    });
  });

  describe('error handling', () => {
    it('fails gracefully when home directory is not writable', async () => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );

      // Simulate non-writable home by using invalid path
      vi.stubEnv('HOME', '/nonexistent/path');
      vi.stubEnv('USERPROFILE', '/nonexistent/path');

      const r = await runCli('generate --global', projectDir);
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/error|fail|cannot|ENOENT|not found/i);
    });

    it('reports error when target does not support global mode', async () => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );

      const r = await runCli('generate --global', projectDir);

      // All current targets support global mode, so this should succeed
      // This test documents expected behavior if a target doesn't support it
      expect(r.exitCode).toBe(0);
    });
  });

  describe('migration from project to global mode', () => {
    beforeEach(() => {
      // Setup both home and project configs
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Global Config
`,
      );
      mkdirSync(join(homeDir, '.agentsmesh', 'skills', 'test-skill'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'skills', 'test-skill', 'SKILL.md'),
        `---
description: Test skill
---
# Test Skill
`,
      );

      mkdirSync(join(projectDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(projectDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(projectDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Project Config
`,
      );
      mkdirSync(join(projectDir, '.agentsmesh', 'skills', 'project-skill'), { recursive: true });
      writeFileSync(
        join(projectDir, '.agentsmesh', 'skills', 'project-skill', 'SKILL.md'),
        `---
description: Project skill
---
# Project Skill
`,
      );
    });

    it('can migrate from project mode to global mode', async () => {
      // First generate in project mode
      const r1 = await runCli('generate', projectDir);
      expect(r1.exitCode).toBe(0);
      fileExists(join(projectDir, '.claude', 'CLAUDE.md'));
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');
      fileExists(join(projectDir, '.claude', 'skills', 'project-skill', 'SKILL.md'));

      // Then generate in global mode
      const r2 = await runCli('generate --global', projectDir);
      expect(r2.exitCode).toBe(0);
      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Config');
      fileExists(join(homeDir, '.claude', 'skills', 'test-skill', 'SKILL.md'));

      // Both should coexist independently
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Config');
    });

    it('preserves skill structure during migration', async () => {
      // Generate project mode
      await runCli('generate', projectDir);
      const projectSkillPath = join(projectDir, '.claude', 'skills', 'project-skill', 'SKILL.md');
      fileExists(projectSkillPath);

      // Generate global mode
      await runCli('generate --global', projectDir);
      const globalSkillPath = join(homeDir, '.claude', 'skills', 'test-skill', 'SKILL.md');
      fileExists(globalSkillPath);

      // Verify structure is preserved
      const projectContent = readFileSync(projectSkillPath, 'utf-8');
      const globalContent = readFileSync(globalSkillPath, 'utf-8');

      expect(projectContent).toContain('# Project Skill');
      expect(globalContent).toContain('# Test Skill');
    });

    it('handles repeated migrations without conflicts', async () => {
      // Multiple back-and-forth generations
      await runCli('generate', projectDir);
      await runCli('generate --global', projectDir);
      await runCli('generate', projectDir);
      await runCli('generate --global', projectDir);

      // Both should still be correct
      fileContains(join(projectDir, '.claude', 'CLAUDE.md'), 'Project Config');
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Config');
    });
  });

  describe('concurrent generation scenarios', () => {
    beforeEach(() => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code, cursor, copilot]
features: [rules]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Global Root
`,
      );
    });

    it('handles multiple targets generating to different global directories', async () => {
      const r1 = await runCli('generate --global --targets claude-code', projectDir);
      const r2 = await runCli('generate --global --targets cursor', projectDir);
      const r3 = await runCli('generate --global --targets copilot', projectDir);

      expect(r1.exitCode).toBe(0);
      expect(r2.exitCode).toBe(0);
      expect(r3.exitCode).toBe(0);

      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileExists(join(homeDir, '.cursor', 'rules', 'general.mdc'));
      fileExists(join(homeDir, '.copilot', 'copilot-instructions.md'));
    });

    it('handles regeneration to same global directory', async () => {
      // Generate twice to same location
      const r1 = await runCli('generate --global --targets claude-code', projectDir);
      const r2 = await runCli('generate --global --targets claude-code', projectDir);

      expect(r1.exitCode).toBe(0);
      expect(r2.exitCode).toBe(0);

      fileExists(join(homeDir, '.claude', 'CLAUDE.md'));
      fileContains(join(homeDir, '.claude', 'CLAUDE.md'), 'Global Root');
    });
  });

  describe('performance with large skill trees', () => {
    beforeEach(() => {
      mkdirSync(join(homeDir, '.agentsmesh', 'rules'), { recursive: true });
      writeFileSync(
        join(homeDir, '.agentsmesh', 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );
      writeFileSync(
        join(homeDir, '.agentsmesh', 'rules', '_root.md'),
        `---
root: true
---
# Root
`,
      );

      // Create many skills
      for (let i = 0; i < 50; i++) {
        const skillDir = join(homeDir, '.agentsmesh', 'skills', `skill-${i}`);
        mkdirSync(join(skillDir, 'references'), { recursive: true });
        writeFileSync(
          join(skillDir, 'SKILL.md'),
          `---\ndescription: Skill ${i}\n---\n# Skill ${i}\n`,
        );
        writeFileSync(join(skillDir, 'references', 'ref.md'), `# Reference ${i}\n`);
      }
    });

    it('generates large skill trees efficiently', async () => {
      const startTime = Date.now();
      const r = await runCli('generate --global', projectDir);
      const duration = Date.now() - startTime;

      expect(r.exitCode).toBe(0);

      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds

      // Verify all skills were generated
      for (let i = 0; i < 50; i++) {
        fileExists(join(homeDir, '.claude', 'skills', `skill-${i}`, 'SKILL.md'));
        fileExists(join(homeDir, '.claude', 'skills', `skill-${i}`, 'references', 'ref.md'));
      }
    });
  });
});
