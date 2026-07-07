import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skillsHandlers } from '../../../../src/mcp/handlers/skills.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let outsideDir: string;
let ctx: McpContext;

async function makeSkill(
  name: string,
  skillMd: string,
  supporting: Record<string, string> = {},
): Promise<void> {
  const dir = join(projectRoot, '.agentsmesh/skills', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), skillMd, 'utf8');
  for (const [p, content] of Object.entries(supporting)) {
    const parts = p.split('/');
    if (parts.length > 1) {
      await mkdir(join(dir, ...parts.slice(0, -1)), { recursive: true });
    }
    await writeFile(join(dir, p), content, 'utf8');
  }
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'skills-'));
  outsideDir = await mkdtemp(join(tmpdir(), 'skills-out-'));
  await mkdir(join(projectRoot, '.agentsmesh/skills'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  await makeSkill(
    'my-skill',
    '---\nname: my-skill\ndescription: does things\n---\n\nskill body\n',
    { 'helper.md': 'helper content', 'template.ts': 'export {};\n' },
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(outsideDir, { recursive: true, force: true });
});

describe('skillsHandlers', () => {
  // 1. list returns name + description summaries
  it('list returns name + description summaries', async () => {
    const list = await skillsHandlers.list(ctx);
    expect(list).toEqual([{ name: 'my-skill', description: 'does things' }]);
  });

  // 2. list returns empty array when skills/ dir missing
  it('list returns empty array when skills/ dir is missing', async () => {
    await rm(join(projectRoot, '.agentsmesh/skills'), { recursive: true });
    const list = await skillsHandlers.list(ctx);
    expect(list).toEqual([]);
  });

  // 3. get returns SKILL.md frontmatter + body + sorted supportingFiles array
  it('get returns SKILL.md frontmatter + body + sorted supportingFiles', async () => {
    const r = await skillsHandlers.get(ctx, { name: 'my-skill' });
    expect(r.name).toBe('my-skill');
    expect(r.body).toBe('skill body\n');
    expect(r.frontmatter).toMatchObject({ name: 'my-skill', description: 'does things' });
    expect(r.supportingFiles).toEqual(['helper.md', 'template.ts']);
  });

  it('get rejects SKILL.md symlinked outside the skill dir', async () => {
    await makeSkill('linked-skill', '---\ndescription: placeholder\n---\n\nbody\n');
    await rm(join(projectRoot, '.agentsmesh/skills/linked-skill/SKILL.md'));
    await writeFile(join(outsideDir, 'SKILL.md'), '---\n---\n\nsecret\n', 'utf8');
    await symlink(
      join(outsideDir, 'SKILL.md'),
      join(projectRoot, '.agentsmesh/skills/linked-skill/SKILL.md'),
    );
    await expect(skillsHandlers.get(ctx, { name: 'linked-skill' })).rejects.toMatchObject({
      code: 'PATH_TRAVERSAL',
    });
  });

  // 4. get throws NOT_FOUND for missing skill
  it('get throws NOT_FOUND for missing skill', async () => {
    await expect(skillsHandlers.get(ctx, { name: 'no-such-skill' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // 5. getFile returns content of supporting file
  it('getFile returns content of supporting file', async () => {
    const r = await skillsHandlers.getFile(ctx, { name: 'my-skill', path: 'helper.md' });
    expect(r.content).toBe('helper content');
    expect(r.encoding).toBe('utf-8');
  });

  // 6. getFile throws PATH_TRAVERSAL on ../etc/passwd etc.
  it('getFile throws PATH_TRAVERSAL on path with ..', async () => {
    await expect(
      skillsHandlers.getFile(ctx, { name: 'my-skill', path: '../etc/passwd.txt' }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });

  // 7. getFile throws NOT_FOUND for missing file
  it('getFile throws NOT_FOUND for missing file', async () => {
    await expect(
      skillsHandlers.getFile(ctx, { name: 'my-skill', path: 'missing.md' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // 8. create writes SKILL.md + every supporting file
  it('create writes SKILL.md + every supporting file', async () => {
    await skillsHandlers.create(ctx, {
      name: 'new-skill',
      frontmatter: { description: 'new one' },
      body: 'new body\n',
      supportingFiles: { 'guide.md': 'guide content', 'script.ts': 'export {};\n' },
    });
    const skillMd = await readFile(
      join(projectRoot, '.agentsmesh/skills/new-skill/SKILL.md'),
      'utf8',
    );
    expect(skillMd).toContain('description: new one');
    expect(skillMd).toContain('new body\n');
    const guide = await readFile(
      join(projectRoot, '.agentsmesh/skills/new-skill/guide.md'),
      'utf8',
    );
    expect(guide).toBe('guide content');
    const script = await readFile(
      join(projectRoot, '.agentsmesh/skills/new-skill/script.ts'),
      'utf8',
    );
    expect(script).toBe('export {};\n');
  });

  // 9. create throws ALREADY_EXISTS for existing skill dir
  it('create throws ALREADY_EXISTS for existing skill dir', async () => {
    await expect(
      skillsHandlers.create(ctx, {
        name: 'my-skill',
        frontmatter: { description: 'dup' },
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  // 10. create honors dry_run (no fs writes)
  it('create honors dry_run (no fs writes)', async () => {
    const r = await skillsHandlers.create(ctx, {
      name: 'dry-skill',
      frontmatter: { description: 'dry' },
      body: 'dry body\n',
      supportingFiles: { 'aux.md': 'aux' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
    expect(r.supportingFilesWritten).toEqual([]);
    // verify nothing was written
    await expect(stat(join(projectRoot, '.agentsmesh/skills/dry-skill'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  // 11. create rejects invalid frontmatter (zod) → VALIDATION_FAILED
  it('create rejects invalid frontmatter → VALIDATION_FAILED', async () => {
    // skillFrontmatter uses passthrough so let's pass a name that is not a string
    await expect(
      skillsHandlers.create(ctx, {
        name: 'valid-name',
        // @ts-expect-error intentional bad type
        frontmatter: { description: 42 },
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  // 12. update: string writes, null deletes, unlisted untouched
  it('update: string writes new content, null deletes, unlisted untouched', async () => {
    // add an unlisted file that should remain untouched
    await writeFile(join(projectRoot, '.agentsmesh/skills/my-skill/untouched.md'), 'stays', 'utf8');
    const r = await skillsHandlers.update(ctx, {
      name: 'my-skill',
      supportingFiles: {
        'helper.md': 'updated helper',
        'template.ts': null,
        'new-file.md': 'brand new',
      },
    });
    expect(r.written).toBe(true);
    expect(r.supportingFilesAffected.written.sort()).toEqual(['helper.md', 'new-file.md'].sort());
    expect(r.supportingFilesAffected.deleted).toEqual(['template.ts']);

    const helper = await readFile(
      join(projectRoot, '.agentsmesh/skills/my-skill/helper.md'),
      'utf8',
    );
    expect(helper).toBe('updated helper');
    await expect(
      stat(join(projectRoot, '.agentsmesh/skills/my-skill/template.ts')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    const untouched = await readFile(
      join(projectRoot, '.agentsmesh/skills/my-skill/untouched.md'),
      'utf8',
    );
    expect(untouched).toBe('stays');
    const newFile = await readFile(
      join(projectRoot, '.agentsmesh/skills/my-skill/new-file.md'),
      'utf8',
    );
    expect(newFile).toBe('brand new');
  });

  it('update rejects writes through symlinked supporting directories', async () => {
    await symlink(outsideDir, join(projectRoot, '.agentsmesh/skills/my-skill/linked'), 'dir');
    await expect(
      skillsHandlers.update(ctx, {
        name: 'my-skill',
        supportingFiles: { 'linked/secret.md': 'secret' },
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });

  it('update rejects deletes through symlinked supporting directories', async () => {
    await writeFile(join(outsideDir, 'secret.md'), 'secret', 'utf8');
    await symlink(outsideDir, join(projectRoot, '.agentsmesh/skills/my-skill/linked'), 'dir');
    await expect(
      skillsHandlers.update(ctx, {
        name: 'my-skill',
        supportingFiles: { 'linked/secret.md': null },
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
    expect(await readFile(join(outsideDir, 'secret.md'), 'utf8')).toBe('secret');
  });

  // 13. update honors dry_run (returns intended written/deleted lists, no fs writes)
  it('update honors dry_run (returns lists, no fs writes)', async () => {
    const r = await skillsHandlers.update(ctx, {
      name: 'my-skill',
      supportingFiles: {
        'helper.md': 'would update',
        'template.ts': null,
      },
      dry_run: true,
    });
    expect(r.written).toBe(false);
    expect(r.supportingFilesAffected.written).toEqual(['helper.md']);
    expect(r.supportingFilesAffected.deleted).toEqual(['template.ts']);
    // verify no changes happened
    const helper = await readFile(
      join(projectRoot, '.agentsmesh/skills/my-skill/helper.md'),
      'utf8',
    );
    expect(helper).toBe('helper content');
    const template = await readFile(
      join(projectRoot, '.agentsmesh/skills/my-skill/template.ts'),
      'utf8',
    );
    expect(template).toBe('export {};\n');
  });

  // 14. update merge: true shallow-merges frontmatter
  it('update merge: true shallow-merges frontmatter', async () => {
    await skillsHandlers.update(ctx, {
      name: 'my-skill',
      frontmatter: { description: 'merged desc' },
      merge: true,
    });
    const r = await skillsHandlers.get(ctx, { name: 'my-skill' });
    expect(r.frontmatter.name).toBe('my-skill');
    expect(r.frontmatter.description).toBe('merged desc');
  });

  // 15. update preserves body when only frontmatter is updated
  it('update preserves body when only frontmatter updated', async () => {
    await skillsHandlers.update(ctx, {
      name: 'my-skill',
      frontmatter: { description: 'changed' },
    });
    const r = await skillsHandlers.get(ctx, { name: 'my-skill' });
    expect(r.body).toBe('skill body\n');
  });

  // 16. update throws NOT_FOUND for missing skill
  it('update throws NOT_FOUND for missing skill', async () => {
    await expect(
      skillsHandlers.update(ctx, { name: 'no-such-skill', frontmatter: {} }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // 17. delete removes whole directory
  it('delete removes whole directory', async () => {
    const r = await skillsHandlers.delete(ctx, { name: 'my-skill' });
    expect(r.deleted).toBe(true);
    await expect(stat(join(projectRoot, '.agentsmesh/skills/my-skill'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  // 18. delete throws NOT_FOUND for missing skill
  it('delete throws NOT_FOUND for missing skill', async () => {
    await expect(skillsHandlers.delete(ctx, { name: 'no-such-skill' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // 19. delete honors dry_run
  it('delete honors dry_run (no removal)', async () => {
    const r = await skillsHandlers.delete(ctx, { name: 'my-skill', dry_run: true });
    expect(r.deleted).toBe(false);
    // directory should still exist
    await expect(stat(join(projectRoot, '.agentsmesh/skills/my-skill'))).resolves.toBeDefined();
  });

  // 20. invalid skill name (regex fail) → INVALID_NAME on create/get/getFile/update/delete
  it('invalid skill name → INVALID_NAME on create', async () => {
    await expect(
      skillsHandlers.create(ctx, { name: '../escape', frontmatter: {}, body: '' }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  it('invalid skill name → INVALID_NAME on get', async () => {
    await expect(skillsHandlers.get(ctx, { name: '../escape' })).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
  });

  it('invalid skill name → INVALID_NAME on getFile', async () => {
    await expect(
      skillsHandlers.getFile(ctx, { name: '../escape', path: 'file.md' }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  it('invalid skill name → INVALID_NAME on update', async () => {
    await expect(
      skillsHandlers.update(ctx, { name: '../escape', frontmatter: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  it('invalid skill name → INVALID_NAME on delete', async () => {
    await expect(skillsHandlers.delete(ctx, { name: '../escape' })).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
  });

  // 21. supporting file path with .. → PATH_TRAVERSAL on create/update
  it('supporting file path with .. → PATH_TRAVERSAL on create', async () => {
    await expect(
      skillsHandlers.create(ctx, {
        name: 'valid-skill',
        frontmatter: {},
        body: 'body',
        supportingFiles: { '../outside.md': 'evil' },
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });

  it('supporting file path with .. → PATH_TRAVERSAL on update', async () => {
    await expect(
      skillsHandlers.update(ctx, {
        name: 'my-skill',
        supportingFiles: { '../outside.md': 'evil' },
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
});
