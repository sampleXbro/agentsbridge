/**
 * Gemini command name inference for install (matches importer-mappers naming).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  inferGeminiCommandNamesFromFiles,
  isUnderGeminiCommands,
} from '../../../src/install/native/gemini-install-commands.js';

const ROOT = join(tmpdir(), 'am-gemini-install-cmd');

describe('isUnderGeminiCommands', () => {
  it('matches root and nested command paths', () => {
    expect(isUnderGeminiCommands('.gemini/commands')).toBe(true);
    expect(isUnderGeminiCommands('.gemini/commands/git')).toBe(true);
    expect(isUnderGeminiCommands('skills/foo')).toBe(false);
  });
});

describe('inferGeminiCommandNamesFromFiles', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, '.gemini', 'commands', 'git'), { recursive: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('maps nested paths to colon names', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'git', 'commit.toml'), 'name = "c"\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'lint.md'), '---\n---\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names.sort()).toEqual(['git:commit', 'lint']);
  });
});
