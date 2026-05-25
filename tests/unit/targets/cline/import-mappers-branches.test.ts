/**
 * Branch coverage for src/targets/cline/importer-mappers.ts:
 * - mapClineRuleFile: frontmatter.description not a string (line 24 ternary).
 * - mapClineWorkflowFile: frontmatter.description present but not a string (line 50-52 ternary).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mapClineRuleFile,
  mapClineWorkflowFile,
} from '../../../../src/targets/cline/importer-mappers.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cline-mappers-'));
});

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = '';
});

describe('mapClineRuleFile / mapClineWorkflowFile — edge branches', () => {
  it('drops non-string frontmatter.description in rule file (uses undefined branch)', async () => {
    const destDir = join(projectRoot, '.agentsmesh/rules');
    mkdirSync(destDir, { recursive: true });
    writeFileSync(
      join(destDir, 'demo.md'),
      '---\ndescription:\n  - not\n  - a string\nglobs: "**/*.ts"\n---\n\nBody\n',
    );
    const result = await mapClineRuleFile('demo.md', destDir, (dest: string): string =>
      readFileSync(dest, 'utf-8'),
    );
    expect(result).not.toBeNull();
    // Description must NOT appear since it isn't a string → undefined → deleted.
    expect(result!.content).not.toContain('not a string');
    expect(result!.content).toContain('globs:');
  });

  it('returns null for workflows/ paths and _root.md', async () => {
    const destDir = join(projectRoot, '.agentsmesh/rules');
    mkdirSync(destDir, { recursive: true });
    const noop = (dest: string): string => dest;
    expect(await mapClineRuleFile('workflows', destDir, noop)).toBeNull();
    expect(await mapClineRuleFile('workflows/x.md', destDir, noop)).toBeNull();
    expect(await mapClineRuleFile('_root.md', destDir, noop)).toBeNull();
  });

  it('handles workflow file where frontmatter.description is non-string (uses empty branch)', async () => {
    const destDir = join(projectRoot, '.agentsmesh/commands');
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, 'wf.md'), '---\ndescription:\n  embedded: true\n---\n\nbody\n');
    const result = await mapClineWorkflowFile('wf.md', destDir, (dest: string): string =>
      readFileSync(dest, 'utf-8'),
    );
    // hasDescription branch with non-string falls back to ''
    expect(result.feature).toBe('commands');
  });
});
