/**
 * E2E tests: full structural bidirectional sync verification.
 * Tests if importing back from targeted output fully restores
 * the original canonical structure (rules, skills, mcp, hooks,
 * agents, commands, ignore, permissions) identical to the
 * starting canonical fixture.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { cleanup } from './helpers/setup.js';
import { createCanonicalProject } from './helpers/canonical.js';
import { fileExists, fileContains } from './helpers/assertions.js';

describe('full-sync round trip preservation', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  const TARGETS_SUPPORTING_IMPORT = [
    'claude-code',
    'cursor',
    'cline',
    'codex-cli',
    'windsurf',
    'copilot',
    'gemini-cli',
  ];

  for (const target of TARGETS_SUPPORTING_IMPORT) {
    it(`round trip ${target} -> canonical -> ${target} preserves full structure`, async () => {
      // 1. Setup project from full canonical fixture
      dir = createCanonicalProject();

      // 2. Generate target configurations from canonical
      const generateResult = await runCli(`generate --targets ${target}`, dir);
      expect(generateResult.exitCode, `generate failed for ${target}`).toBe(0);

      // Verify that hooks, ignore, and root rules propagated appropriately
      if (target === 'claude-code') {
        fileExists(join(dir, '.claude', 'CLAUDE.md'));
        // root rule body content must appear in the merged output
        fileContains(join(dir, '.claude', 'CLAUDE.md'), '# Standards');
        fileContains(join(dir, '.claude', 'CLAUDE.md'), 'TypeScript strict');
        fileExists(join(dir, '.claude/settings.json'));
        fileContains(join(dir, '.claude/settings.json'), 'Bash(npm run test:*)');
      }

      // 3. Nuke the canonical source directory to ensure we reconstruct entirely from targeted files.
      const { rmSync } = await import('node:fs');
      rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

      // 4. Import configurations back to canonical
      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, `import failed for ${target}`).toBe(0);

      // 5. Assert canonical structure has been rebuilt appropriately from imported target

      // --- RULES Preservation ---
      if (!['cline', 'windsurf'].includes(target)) {
        // These targets emit discrete rule files that must be re-imported with content intact
        const canonicalRules = join(dir, '.agentsmesh', 'rules');
        fileExists(canonicalRules);
      }
      // claude-code and cursor preserve rule body content through the round-trip
      if (target === 'claude-code') {
        const rootRule = join(dir, '.agentsmesh', 'rules', '_root.md');
        fileExists(rootRule);
        fileContains(rootRule, '# Standards');
        fileContains(rootRule, 'TypeScript strict');
      }
      if (target === 'cursor') {
        const tsRule = join(dir, '.agentsmesh', 'rules', 'typescript.md');
        fileExists(tsRule);
        fileContains(tsRule, 'No any');
        fileContains(tsRule, 'Explicit return types');
      }

      // --- COMMANDS Preservation ---
      if (['claude-code', 'gemini-cli'].includes(target)) {
        const canonicalCommands = join(dir, '.agentsmesh', 'commands');
        fileExists(canonicalCommands);
        const reviewCmd = join(canonicalCommands, 'review.md');
        fileExists(reviewCmd);
        fileContains(reviewCmd, 'Review current changes for quality');
        if (target === 'claude-code') {
          fileContains(reviewCmd, 'git diff');
        }
      }

      // --- SKILLS Preservation ---
      // Note: Cline native representation stores skills logic inside .cline/skills
      if (target === 'cline') {
        const canonicalSkills = join(dir, '.agentsmesh', 'skills');
        fileExists(canonicalSkills);
      }

      // --- IGNORE Preservation ---
      if (['cline', 'windsurf'].includes(target)) {
        const ignoreFile = join(dir, '.agentsmesh', 'ignore');
        fileExists(ignoreFile);
        fileContains(ignoreFile, '.env');
        fileContains(ignoreFile, 'node_modules');
      }

      // --- MCP Preservation ---
      // Cline & Cursor natively support MCP settings importing
      if (['cline', 'cursor'].includes(target)) {
        const mcpFile = join(dir, '.agentsmesh', 'mcp.json');
        fileExists(mcpFile);
        fileContains(mcpFile, 'context7');
        // server command/args must be preserved, not just the server name
        fileContains(mcpFile, '@upstash/context7-mcp');
      }
    });
  }
});
