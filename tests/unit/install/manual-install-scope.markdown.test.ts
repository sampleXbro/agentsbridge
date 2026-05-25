import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageManualInstallScope } from '../../../src/install/manual/manual-install-scope.js';
import { listRelativeFiles } from '../../helpers/install-test-helpers.js';

const ROOT = join(tmpdir(), 'am-manual-install-scope-markdown');

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('stageManualInstallScope markdown collections', () => {
  it.each(['agents', 'commands', 'rules'] as const)(
    'stages a single %s markdown file',
    async (as) => {
      const source = join(ROOT, as, `${as}-one.md`);
      mkdirSync(join(ROOT, as), { recursive: true });
      writeFileSync(source, '---\ndescription: One\n---\n\nBody\n');

      const staged = await stageManualInstallScope(source, as);
      try {
        expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', as))).toEqual([
          `${as}-one.md`,
        ]);
      } finally {
        await staged.cleanup();
      }
    },
  );

  it.each(['agents', 'commands', 'rules'] as const)(
    'stages a %s folder of markdown files',
    async (as) => {
      const source = join(ROOT, as);
      mkdirSync(join(source, 'nested'), { recursive: true });
      writeFileSync(join(source, 'first.md'), '---\ndescription: First\n---\n\nOne\n');
      writeFileSync(join(source, 'nested', 'second.md'), '---\ndescription: Second\n---\n\nTwo\n');

      const staged = await stageManualInstallScope(source, as);
      try {
        expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', as))).toEqual([
          'first.md',
          'second.md',
        ]);
      } finally {
        await staged.cleanup();
      }
    },
  );

  it.each(['agents', 'commands', 'rules'] as const)(
    'filters repo boilerplate markdown when staging %s folders',
    async (as) => {
      const source = join(ROOT, as);
      mkdirSync(source, { recursive: true });
      writeFileSync(join(source, 'README.md'), '# Documentation\n');
      writeFileSync(join(source, 'CONTRIBUTING.md'), '# Contributing\n');
      writeFileSync(join(source, 'LICENSE.md'), 'MIT\n');
      writeFileSync(join(source, 'CODE_OF_CONDUCT.md'), '# Code\n');
      writeFileSync(join(source, 'first.md'), '---\ndescription: First\n---\n\nOne\n');

      const staged = await stageManualInstallScope(source, as);
      try {
        expect(listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', as))).toEqual([
          'first.md',
        ]);
      } finally {
        await staged.cleanup();
      }
    },
  );

  it('stages .mdc files as normalised .md for rules', async () => {
    const source = join(ROOT, 'rules-mdc');
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, 'root.mdc'),
      '---\nalwaysApply: true\ndescription: Root\n---\n\nBody\n',
    );
    writeFileSync(
      join(source, 'scoped.mdc'),
      '---\nalwaysApply: false\nglobs:\n  - "*.ts"\ndescription: TS\n---\n\nTS body\n',
    );

    const staged = await stageManualInstallScope(source, 'rules');
    try {
      const stagedDir = join(staged.discoveryRoot, '.agentsmesh', 'rules');
      const files = listRelativeFiles(stagedDir);
      expect(files.sort()).toEqual(['root.md', 'scoped.md']);
      const rootContent = readFileSync(join(stagedDir, 'root.md'), 'utf8');
      expect(rootContent).toContain('root: true');
      expect(rootContent).not.toContain('alwaysApply');
      const scopedContent = readFileSync(join(stagedDir, 'scoped.md'), 'utf8');
      expect(scopedContent).toContain('trigger: glob');
      expect(scopedContent).not.toContain('alwaysApply');
    } finally {
      await staged.cleanup();
    }
  });

  it('stages mixed .md and .mdc files for rules', async () => {
    const source = join(ROOT, 'rules-mixed');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'plain.md'), '---\ndescription: Plain\n---\n\nPlain body\n');
    writeFileSync(
      join(source, 'cursor.mdc'),
      '---\nalwaysApply: true\ndescription: Cursor\n---\n\nCursor body\n',
    );

    const staged = await stageManualInstallScope(source, 'rules');
    try {
      const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', 'rules'));
      expect(files.sort()).toEqual(['cursor.md', 'plain.md']);
    } finally {
      await staged.cleanup();
    }
  });

  it.each(['agents', 'commands'] as const)(
    'rejects .mdc single file for %s (only rules accept .mdc)',
    async (as) => {
      const source = join(ROOT, `${as}.mdc`);
      mkdirSync(ROOT, { recursive: true });
      writeFileSync(source, '---\nalwaysApply: true\n---\n\nBody');

      await expect(stageManualInstallScope(source, as)).rejects.toThrow(
        'Manual install only supports .md files',
      );
    },
  );

  it.each(['agents', 'commands', 'rules'] as const)(
    'rejects non-markdown files for %s',
    async (as) => {
      const source = join(ROOT, `${as}.txt`);
      mkdirSync(ROOT, { recursive: true });
      writeFileSync(source, 'not markdown');

      await expect(stageManualInstallScope(source, as)).rejects.toThrow(
        'Manual install only supports .md files',
      );
    },
  );

  it.each(['agents', 'commands', 'rules'] as const)('rejects empty folders for %s', async (as) => {
    const source = join(ROOT, as);
    mkdirSync(source, { recursive: true });

    await expect(stageManualInstallScope(source, as)).rejects.toThrow('No installable files found');
  });

  it.each(['agents', 'commands', 'rules'] as const)(
    'namespaces colliding basenames across subdirectories for %s',
    async (as) => {
      const source = join(ROOT, as);
      mkdirSync(join(source, 'alpha'), { recursive: true });
      mkdirSync(join(source, 'beta'), { recursive: true });
      writeFileSync(join(source, 'alpha', 'same.md'), '---\ndescription: A\n---\n');
      writeFileSync(join(source, 'beta', 'same.md'), '---\ndescription: B\n---\n');

      const staged = await stageManualInstallScope(source, as);
      try {
        const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', as)).sort();
        expect(files).toEqual(['alpha-same.md', 'beta-same.md']);
      } finally {
        await staged.cleanup();
      }
    },
  );

  it('namespaces .md vs .mdc collision after extension normalization for rules', async () => {
    const source = join(ROOT, 'rules-collide');
    mkdirSync(join(source, 'docs'), { recursive: true });
    mkdirSync(join(source, 'cursor'), { recursive: true });
    writeFileSync(join(source, 'docs', 'docker.md'), '---\ndescription: Plain\n---\n');
    writeFileSync(
      join(source, 'cursor', 'docker.mdc'),
      '---\nalwaysApply: true\ndescription: Cursor\n---\n\nBody\n',
    );

    const staged = await stageManualInstallScope(source, 'rules');
    try {
      const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', 'rules')).sort();
      expect(files).toEqual(['cursor-docker.md', 'docs-docker.md']);
    } finally {
      await staged.cleanup();
    }
  });

  it.each(['agents', 'commands', 'rules'] as const)(
    'keeps bare basenames when no collision exists for %s',
    async (as) => {
      const source = join(ROOT, as);
      mkdirSync(join(source, 'sub'), { recursive: true });
      writeFileSync(join(source, 'top.md'), '---\ndescription: Top\n---\n');
      writeFileSync(join(source, 'sub', 'nested.md'), '---\ndescription: Nested\n---\n');

      const staged = await stageManualInstallScope(source, as);
      try {
        const files = listRelativeFiles(join(staged.discoveryRoot, '.agentsmesh', as)).sort();
        expect(files).toEqual(['nested.md', 'top.md']);
      } finally {
        await staged.cleanup();
      }
    },
  );
});
