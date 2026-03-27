import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
    'rejects non-markdown files for %s',
    async (as) => {
      const source = join(ROOT, `${as}.txt`);
      mkdirSync(ROOT, { recursive: true });
      writeFileSync(source, 'not markdown');

      await expect(stageManualInstallScope(source, as)).rejects.toThrow(
        'Manual install only supports .md files for this collection',
      );
    },
  );

  it.each(['agents', 'commands', 'rules'] as const)('rejects empty folders for %s', async (as) => {
    const source = join(ROOT, as);
    mkdirSync(source, { recursive: true });

    await expect(stageManualInstallScope(source, as)).rejects.toThrow('No .md files found under');
  });

  it.each(['agents', 'commands', 'rules'] as const)(
    'rejects duplicate basenames in %s folders',
    async (as) => {
      const source = join(ROOT, as);
      mkdirSync(join(source, 'a'), { recursive: true });
      mkdirSync(join(source, 'b'), { recursive: true });
      writeFileSync(join(source, 'a', 'same.md'), '---\ndescription: A\n---\n');
      writeFileSync(join(source, 'b', 'same.md'), '---\ndescription: B\n---\n');

      await expect(stageManualInstallScope(source, as)).rejects.toThrow(
        'Manual install found duplicate file name "same.md"',
      );
      expect(existsSync(join(ROOT, '.agentsmesh'))).toBe(false);
    },
  );
});
