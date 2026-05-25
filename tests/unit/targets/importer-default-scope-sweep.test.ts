/**
 * Sweep test: each target importer that accepts `options: { scope? }`
 * is called with NO scope option, exercising the
 * `options.scope ?? 'project'` default branch.
 *
 * Goal: hit the default branch only — file contents and side-effects are
 * already covered by per-target importer tests. We just need each call to
 * NOT throw on an empty scaffolded project.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { importFromAider } from '../../../src/targets/aider/importer.js';
import { importFromAmp } from '../../../src/targets/amp/importer.js';
import { importFromCopilot } from '../../../src/targets/copilot/importer.js';
import { importFromCrush } from '../../../src/targets/crush/importer.js';
import { importFromGoose } from '../../../src/targets/goose/importer.js';
import { importFromKiloCode } from '../../../src/targets/kilo-code/importer.js';
import { importFromKiro } from '../../../src/targets/kiro/importer.js';
import { importFromOpenCode } from '../../../src/targets/opencode/importer.js';
import { importFromQwenCode } from '../../../src/targets/qwen-code/importer.js';
import { importFromRooCode } from '../../../src/targets/roo-code/importer.js';
import { importFromWarp } from '../../../src/targets/warp/importer.js';

type Importer = (root: string) => Promise<unknown>;

const importers: ReadonlyArray<readonly [string, Importer]> = [
  ['aider', importFromAider],
  ['amp', importFromAmp],
  ['copilot', importFromCopilot],
  ['crush', importFromCrush],
  ['goose', importFromGoose],
  ['kilo-code', importFromKiloCode],
  ['kiro', importFromKiro],
  ['opencode', importFromOpenCode],
  ['qwen-code', importFromQwenCode],
  ['roo-code', importFromRooCode],
  ['warp', importFromWarp],
];

describe('importer default scope sweep', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'am-default-scope-'));
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [name, fn] of importers) {
    it(`importFrom${name} defaults to project scope when no options passed`, async () => {
      const results = await fn(root);
      expect(Array.isArray(results)).toBe(true);
    });
  }
});
