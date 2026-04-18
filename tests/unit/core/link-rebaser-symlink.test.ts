import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

describe('rewriteFileLinks with symlinked roots', () => {
  it('prefers descriptor-mapped artifact paths over real canonical paths', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'am-link-rebaser-symlink-'));
    const realRoot = join(tempRoot, 'real');
    const linkRoot = join(tempRoot, 'link');
    mkdirSync(join(realRoot, '.agentsmesh', 'skills', 'api-gen'), { recursive: true });
    mkdirSync(join(realRoot, '.claude', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(realRoot, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'), '# Skill');
    writeFileSync(join(realRoot, '.claude', 'skills', 'api-gen', 'SKILL.md'), '# Skill');
    symlinkSync(realRoot, linkRoot, 'dir');

    try {
      const canonicalPath = join(linkRoot, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md');
      const targetPath = join(linkRoot, '.claude', 'skills', 'api-gen', 'SKILL.md');
      const result = rewriteFileLinks({
        content: 'Use .agentsmesh/skills/api-gen/SKILL.md.',
        projectRoot: linkRoot,
        sourceFile: join(linkRoot, '.agentsmesh', 'rules', '_root.md'),
        destinationFile: join(linkRoot, '.claude', 'CLAUDE.md'),
        translatePath: (abs) => (abs === canonicalPath ? targetPath : abs),
        pathExists: (abs) => abs === targetPath || existsSync(abs),
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe('Use ./skills/api-gen/SKILL.md.');
      expect(result.missing).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
