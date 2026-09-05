/** agentsmesh.local.yaml must not silently drop keys the schema advertises. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfigFromExactDir } from '../../../src/config/core/loader.js';
import { logger } from '../../../src/utils/output/logger.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'am-'));
  await writeFile(
    join(dir, 'agentsmesh.yaml'),
    [
      'version: 1',
      'targets: [claude-code]',
      'features: [rules]',
      'plugins:',
      '  - id: alpha',
      '    source: ./plugins/alpha',
      'pluginTargets: [alpha]',
      'collaboration:',
      '  strategy: merge',
      '',
    ].join('\n'),
    'utf-8',
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe('local overrides: plugins, pluginTargets, collaboration', () => {
  it('appends plugins and pluginTargets (local wins on the same id) and replaces collaboration', async () => {
    await writeFile(
      join(dir, 'agentsmesh.local.yaml'),
      [
        'plugins:',
        '  - id: alpha',
        '    source: ./plugins/alpha-dev',
        '  - id: beta',
        '    source: ./plugins/beta',
        'pluginTargets: [beta, alpha]',
        'collaboration:',
        '  strategy: lock',
        '',
      ].join('\n'),
      'utf-8',
    );
    const { config } = await loadConfigFromExactDir(dir);
    expect(config.plugins.map((p) => [p.id, p.source])).toEqual([
      ['alpha', './plugins/alpha-dev'],
      ['beta', './plugins/beta'],
    ]);
    expect(config.pluginTargets).toEqual(['alpha', 'beta']);
    expect(config.collaboration?.strategy).toBe('lock');
  });

  it('warns about a local key the merge does not handle', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await writeFile(join(dir, 'agentsmesh.local.yaml'), 'unknownKey: 1\n', 'utf-8');
    await loadConfigFromExactDir(dir);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknownKey'));
  });
});
