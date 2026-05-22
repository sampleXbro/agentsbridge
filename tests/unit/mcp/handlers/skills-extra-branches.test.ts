/**
 * Extra branch coverage for `src/mcp/handlers/skills.ts` — fills gaps left
 * by `skills.test.ts`:
 *   - `list` silently skips skill directories without a SKILL.md
 *   - `update` replaces (merge: false) frontmatter wholesale
 *   - `update` silently swallows ENOENT when deleting a missing supporting file
 *   - `update` without `supportingFiles` falls back to {} (no writes/deletes)
 *   - `create` rejects when supporting files exceed MAX_DIR_ENTRIES
 *   - `atomicWrite` rejects bodies larger than MAX_FILE_SIZE_BYTES (1 MiB)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillsHandlers } from '../../../../src/mcp/handlers/skills.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'skills-extra-'));
  await mkdir(join(projectRoot, '.agentsmesh/skills'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('skillsHandlers — extra branches', () => {
  it('list skips skill directories that lack a SKILL.md', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/skills', 'incomplete'), { recursive: true });
    expect(await skillsHandlers.list(ctx)).toEqual([]);
  });

  it('update replaces frontmatter wholesale when merge is false', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/skills/replace-me'), { recursive: true });
    await writeFile(
      join(projectRoot, '.agentsmesh/skills/replace-me/SKILL.md'),
      '---\nname: replace-me\ndescription: original\n---\nbody\n',
      'utf8',
    );
    await skillsHandlers.update(ctx, {
      name: 'replace-me',
      frontmatter: { description: 'only-new-key' },
      merge: false,
    });
    const got = await skillsHandlers.get(ctx, { name: 'replace-me' });
    expect(got.frontmatter.name).toBeUndefined();
    expect(got.frontmatter.description).toBe('only-new-key');
  });

  it('update silently no-ops when asked to delete a supporting file that does not exist', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/skills/skill1'), { recursive: true });
    await writeFile(
      join(projectRoot, '.agentsmesh/skills/skill1/SKILL.md'),
      '---\nname: skill1\n---\n',
      'utf8',
    );
    const r = await skillsHandlers.update(ctx, {
      name: 'skill1',
      supportingFiles: { 'never-existed.md': null },
    });
    expect(r.written).toBe(true);
    expect(r.supportingFilesAffected.deleted).toEqual([]);
  });

  it('update without supportingFiles defaults to {} (no writes or deletes)', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/skills/skill2'), { recursive: true });
    await writeFile(
      join(projectRoot, '.agentsmesh/skills/skill2/SKILL.md'),
      '---\nname: skill2\n---\n',
      'utf8',
    );
    const r = await skillsHandlers.update(ctx, { name: 'skill2' });
    expect(r.supportingFilesAffected).toEqual({ written: [], deleted: [] });
  });

  it('create rejects when supportingFiles + SKILL.md exceed MAX_DIR_ENTRIES (1000)', async () => {
    const supportingFiles: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) supportingFiles[`f${i}.md`] = 'x';
    await expect(
      skillsHandlers.create(ctx, {
        name: 'too-many',
        frontmatter: { description: 'd' },
        body: 'b',
        supportingFiles,
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });

  it('rejects bodies larger than 1 MiB (atomicWrite size cap)', async () => {
    const tooBig = 'x'.repeat(1_048_577);
    await expect(
      skillsHandlers.create(ctx, {
        name: 'huge',
        frontmatter: { description: 'd' },
        body: tooBig,
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});
