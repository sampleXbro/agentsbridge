import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseIndex } from '../../src/lessons/index-schema.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const paths = lessonsPaths(REPO);
const idx = parseIndex(parseYaml(readFileSync(paths.index, 'utf8')) as unknown);

describe('.agentsmesh/lessons/index.yaml', () => {
  it('parses successfully', () => {
    expect(idx.clusters.length).toBeGreaterThanOrEqual(1);
  });

  it.each(idx.clusters.map((c) => [c.topic, c.file] as const))(
    'cluster %s resolves to existing topic file %s',
    (_topic, file) => {
      const p = join(REPO, file);
      expect(existsSync(p), `${p} missing`).toBe(true);
    },
  );

  it.each(idx.clusters.map((c) => [c.topic, c.triggers] as const))(
    'cluster %s declares at least one trigger of any type',
    (_topic, triggers) => {
      expect(
        triggers.file_globs.length + triggers.command_patterns.length + triggers.keywords.length,
      ).toBeGreaterThan(0);
    },
  );
});
