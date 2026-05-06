/**
 * Integration test: MCP resource limit caps exercised against real handlers and
 * real filesystem I/O (no mocks).
 *
 * Covers:
 * 1. Body exceeding MAX_FILE_SIZE_BYTES → LIMIT_EXCEEDED before any write.
 * 2. Directory at MAX_DIR_ENTRIES → next create → LIMIT_EXCEEDED, fs untouched.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rulesHandlers } from '../../src/mcp/handlers/rules.js';
import { resolveContext } from '../../src/mcp/context.js';
import { MAX_DIR_ENTRIES, MAX_FILE_SIZE_BYTES } from '../../src/mcp/limits.js';
import type { McpContext } from '../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'am-mcp-limits-'));
  await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  // Required _root.md for project context resolution
  await writeFile(
    join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n\nRoot.\n',
    'utf8',
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('mcp resource limits (integration)', () => {
  it('rejects body exceeding MAX_FILE_SIZE_BYTES with LIMIT_EXCEEDED and leaves fs untouched', async () => {
    const oversizeBody = 'x'.repeat(MAX_FILE_SIZE_BYTES + 1);

    await expect(
      rulesHandlers.create(ctx, {
        name: 'big-rule',
        frontmatter: { description: 'oversize' },
        body: oversizeBody,
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });

    // Verify file was NOT created
    const entries = await readdir(join(projectRoot, '.agentsmesh', 'rules'));
    expect(entries).not.toContain('big-rule.md');
  });

  it('rejects create when directory is at MAX_DIR_ENTRIES with LIMIT_EXCEEDED', async () => {
    const rulesDir = join(projectRoot, '.agentsmesh', 'rules');

    // Create MAX_DIR_ENTRIES - 1 additional rules (already have _root.md = 1 entry).
    // We need total entries to reach MAX_DIR_ENTRIES before the new create.
    const needed = MAX_DIR_ENTRIES - 1; // _root.md is already 1
    await Promise.all(
      Array.from({ length: needed }, (_, i) =>
        writeFile(
          join(rulesDir, `rule-${String(i).padStart(6, '0')}.md`),
          '---\n---\n\nbody\n',
          'utf8',
        ),
      ),
    );

    // Confirm we are exactly at MAX_DIR_ENTRIES
    const before = await readdir(rulesDir);
    expect(before).toHaveLength(MAX_DIR_ENTRIES);

    // Next create must be rejected
    await expect(
      rulesHandlers.create(ctx, {
        name: 'overflow',
        frontmatter: { description: 'one too many' },
        body: 'body\n',
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });

    // Directory count must be unchanged
    const after = await readdir(rulesDir);
    expect(after).toHaveLength(MAX_DIR_ENTRIES);
    expect(after).not.toContain('overflow.md');
  });

  it('dry_run on create does not write even when within limits', async () => {
    const result = await rulesHandlers.create(ctx, {
      name: 'dry-test',
      frontmatter: { description: 'dry' },
      body: 'body\n',
      dry_run: true,
    });

    expect(result.written).toBe(false);
    const entries = await readdir(join(projectRoot, '.agentsmesh', 'rules'));
    expect(entries).not.toContain('dry-test.md');
  });
});
