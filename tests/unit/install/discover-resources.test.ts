import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverFromContentRoot } from '../../../src/install/core/discover-resources.js';

const ROOT = join(tmpdir(), 'am-discover-test');

describe('discoverFromContentRoot', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('returns implicitPick for a single rule file path', async () => {
    const rules = join(ROOT, 'rules');
    mkdirSync(rules);
    const f = join(rules, 'only.md');
    writeFileSync(f, '---\ndescription: d\n---\n');
    const r = await discoverFromContentRoot(f);
    expect(r.implicitPick).toEqual({ rules: ['only'] });
    expect(r.features).toContain('rules');
    expect(r.canonical.rules.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty features for empty .agentsmesh tree', async () => {
    const proj = join(ROOT, 'empty-ab');
    mkdirSync(join(proj, '.agentsmesh'), { recursive: true });
    const r = await discoverFromContentRoot(proj);
    expect(r.features.length).toBe(0);
    expect(r.implicitPick).toBeUndefined();
  });
});
