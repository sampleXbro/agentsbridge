import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCanonicalFiles } from '../../src/canonical/loader.js';
import { createCanonicalProject } from './helpers/canonical.js';
import { runCli } from './helpers/run-cli.js';
import { cleanup } from './helpers/setup.js';

const TARGETS = [
  'claude-code',
  'cursor',
  'copilot',
  'gemini-cli',
  'cline',
  'codex-cli',
  'windsurf',
] as const;

describe('import metadata preservation', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each(TARGETS)(
    're-import from %s preserves existing canonical root and command metadata',
    async (target) => {
      dir = createCanonicalProject();

      const generateResult = await runCli(`generate --targets ${target}`, dir);
      expect(generateResult.exitCode, generateResult.stderr).toBe(0);

      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, importResult.stderr).toBe(0);

      const canonical = await loadCanonicalFiles(dir);
      const rootRule = canonical.rules.find((rule) => rule.root);
      const reviewCommand = canonical.commands.find((command) => command.name === 'review');

      expect(rootRule).toBeDefined();
      expect(rootRule?.description).toBe('Project-wide coding standards');
      expect(rootRule?.body).toContain('TypeScript strict');

      expect(reviewCommand).toBeDefined();
      expect(reviewCommand?.description).toBe('Code review');
      expect(reviewCommand?.allowedTools).toEqual(['Read', 'Grep', 'Bash(git diff)']);
      expect(reviewCommand?.body).toBe('Review current changes for quality.');

      const rulesDir = join(dir, '.agentsbridge', 'rules');
      const importedRuleFiles = readdirSync(rulesDir)
        .filter((name) => name.endsWith('.md'))
        .sort();
      expect(importedRuleFiles.length).toBeGreaterThan(0);
      for (const ruleFile of importedRuleFiles) {
        const content = readFileSync(join(rulesDir, ruleFile), 'utf-8');
        const expectedRoot = ruleFile === '_root.md' ? 'true' : 'false';
        expect(content).toContain(`root: ${expectedRoot}`);
      }
    },
  );
});
