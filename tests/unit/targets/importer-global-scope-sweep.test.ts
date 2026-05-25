/**
 * Sweep test: each per-target importer that accepts `options.scope === 'global'`
 * is invoked with scope=global on an empty scaffolded project. Goal is to
 * exercise the `scope === 'global' ? GLOBAL_* : *` ternaries inside each
 * importer (line ~28-38 in many target files). Side-effects are already
 * covered by per-target tests; we only need the branch to be reached.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { importFromAider } from '../../../src/targets/aider/importer.js';
import { importFromAmp } from '../../../src/targets/amp/importer.js';
import { importFromCrush } from '../../../src/targets/crush/importer.js';
import { importFromGoose } from '../../../src/targets/goose/importer.js';
import { importFromKiloCode } from '../../../src/targets/kilo-code/importer.js';
import { importFromKiro } from '../../../src/targets/kiro/importer.js';
import { importFromOpenCode } from '../../../src/targets/opencode/importer.js';
import { importFromQwenCode } from '../../../src/targets/qwen-code/importer.js';
import { importFromRooCode } from '../../../src/targets/roo-code/importer.js';
import { importFromWarp } from '../../../src/targets/warp/importer.js';
import { importFromCopilot } from '../../../src/targets/copilot/importer.js';

type Importer = (root: string, opts: { scope: 'global' }) => Promise<unknown>;

const importers: ReadonlyArray<readonly [string, Importer]> = [
  ['aider', importFromAider as unknown as Importer],
  ['amp', importFromAmp as unknown as Importer],
  ['copilot', importFromCopilot as unknown as Importer],
  ['crush', importFromCrush as unknown as Importer],
  ['goose', importFromGoose as unknown as Importer],
  ['kilo-code', importFromKiloCode as unknown as Importer],
  ['kiro', importFromKiro as unknown as Importer],
  ['opencode', importFromOpenCode as unknown as Importer],
  ['qwen-code', importFromQwenCode as unknown as Importer],
  ['roo-code', importFromRooCode as unknown as Importer],
  ['warp', importFromWarp as unknown as Importer],
];

describe('importer global-scope sweep', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'am-global-scope-'));
    mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [name, fn] of importers) {
    it(`importFrom${name}({ scope: 'global' }) returns an array without throwing on an empty project`, async () => {
      const results = await fn(root, { scope: 'global' });
      expect(Array.isArray(results)).toBe(true);
    });
  }
});
