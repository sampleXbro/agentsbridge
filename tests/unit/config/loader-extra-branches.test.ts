import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFromExactDir } from '../../../src/config/core/loader.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-rem-loader-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loader extra branches — falsy defaults', () => {
  it('uses {} as base when project has no overrides but local sets them', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1');
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      `overrides:
  claude-code:
    extra_rules: ["a.md"]
`,
    );
    const result = await loadConfigFromExactDir(dir);
    expect(result.config.overrides?.['claude-code']).toEqual({ extra_rules: ['a.md'] });
  });

  it('uses {} as base when project has no conversions but local sets them', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1\ntargets: [claude-code]');
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      `conversions:
  commands_to_skills:
    codex-cli: true
`,
    );
    const result = await loadConfigFromExactDir(dir);
    expect(result.config.conversions?.commands_to_skills?.['codex-cli']).toBe(true);
  });

  it('uses [] as base when project has no extends but local appends some', async () => {
    writeFileSync(join(dir, 'agentsmesh.yaml'), 'version: 1');
    writeFileSync(
      join(dir, 'agentsmesh.local.yaml'),
      `extends:
  - name: fresh
    source: ./shared
    features: [rules]
`,
    );
    const result = await loadConfigFromExactDir(dir);
    expect(result.config.extends).toHaveLength(1);
    expect(result.config.extends?.[0]?.name).toBe('fresh');
  });
});
