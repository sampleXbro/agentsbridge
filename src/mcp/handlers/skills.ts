import { z } from 'zod';
import { resolve, dirname } from 'node:path';
import { readdir, readFile, stat, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import type { McpContext } from '../context.js';
import { McpError } from '../errors.js';
import { MAX_DIR_ENTRIES, MAX_FILE_SIZE_BYTES } from '../limits.js';
import { parseMd, serializeMd } from '../writers/md-frontmatter.js';
import { safeRead } from '../writers/safe-read.js';
import { assertContainedPath } from '../writers/path-containment.js';

const NAME_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/;
const SUPPORT_PATH_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_/-]*\.[a-zA-Z0-9]+$/;

const skillFrontmatter = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

function checkName(name: string): void {
  if (!NAME_RE.test(name)) throw new McpError('INVALID_NAME', `invalid skill name: ${name}`);
}

function checkSupportPath(p: string): void {
  if (!SUPPORT_PATH_RE.test(p) || p.includes('..') || p.includes('//')) {
    throw new McpError('PATH_TRAVERSAL', `invalid supporting-file path: ${p}`);
  }
}

async function atomicWrite(
  projectRoot: string,
  root: string,
  target: string,
  content: string,
): Promise<void> {
  await assertContainedPath({
    root,
    target,
    boundaryRoot: projectRoot,
    message: 'file escapes skill directory',
  });
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new McpError('LIMIT_EXCEEDED', 'file body exceeds 1 MiB cap');
  }
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, target);
}

const skillsDir = (root: string): string => resolve(root, '.agentsmesh/skills');
const skillDir = (root: string, name: string): string => resolve(skillsDir(root), name);

async function assertSkillFile(projectRoot: string, dir: string, target: string): Promise<void> {
  await assertContainedPath({
    root: dir,
    target,
    boundaryRoot: projectRoot,
    message: 'file escapes skill directory',
  });
}

export interface SkillSummary {
  name: string;
  description: string | null;
}

export const skillsHandlers = {
  async list(ctx: McpContext): Promise<SkillSummary[]> {
    // Reject a symlinked skills tree before enumerating (mirrors canonical list).
    await assertContainedPath({
      root: ctx.projectRoot,
      target: skillsDir(ctx.projectRoot),
      message: 'skills directory escapes project',
    });
    let entries: string[];
    try {
      entries = (await readdir(skillsDir(ctx.projectRoot), { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
    const out: SkillSummary[] = [];
    for (const name of entries) {
      try {
        const dir = skillDir(ctx.projectRoot, name);
        const skillMd = resolve(dir, 'SKILL.md');
        await assertSkillFile(ctx.projectRoot, dir, skillMd);
        const src = await readFile(skillMd, 'utf8');
        const fm = parseMd(src).frontmatter as { description?: string };
        out.push({ name, description: fm.description ?? null });
      } catch {
        // skip incomplete skills (no SKILL.md)
      }
    }
    return out;
  },

  async get(
    ctx: McpContext,
    { name }: { name: string },
  ): Promise<{
    name: string;
    frontmatter: Record<string, unknown>;
    body: string;
    supportingFiles: string[];
  }> {
    checkName(name);
    const dir = skillDir(ctx.projectRoot, name);
    const skillMd = resolve(dir, 'SKILL.md');
    await assertSkillFile(ctx.projectRoot, dir, skillMd);
    try {
      const src = await readFile(skillMd, 'utf8');
      const { frontmatter, body } = parseMd(src);
      const all = await readdir(dir);
      const supportingFiles = all.filter((f) => f !== 'SKILL.md').sort();
      return { name, frontmatter, body, supportingFiles };
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new McpError('NOT_FOUND', `skill "${name}" not found`);
      }
      throw new McpError('IO_ERROR', 'failed to read skill');
    }
  },

  async getFile(
    ctx: McpContext,
    { name, path }: { name: string; path: string },
  ): Promise<{ content: string; encoding: 'utf-8' }> {
    checkName(name);
    checkSupportPath(path);
    return {
      content: await safeRead({ projectRoot: ctx.projectRoot, skillName: name, filePath: path }),
      encoding: 'utf-8',
    };
  },

  async create(
    ctx: McpContext,
    input: {
      name: string;
      frontmatter: Record<string, unknown>;
      body: string;
      supportingFiles?: Record<string, string>;
      dry_run?: boolean;
    },
  ): Promise<{ path: string; written: boolean; supportingFilesWritten: string[] }> {
    checkName(input.name);
    const dir = skillDir(ctx.projectRoot, input.name);
    // Assert containment BEFORE the existence probe so a symlinked skills tree
    // cannot leak an out-of-project existence oracle via ALREADY_EXISTS.
    await assertContainedPath({
      root: skillsDir(ctx.projectRoot),
      target: dir,
      boundaryRoot: ctx.projectRoot,
      message: 'skill escapes skills directory',
    });
    const parsed = skillFrontmatter.safeParse(input.frontmatter);
    if (!parsed.success) {
      throw new McpError('VALIDATION_FAILED', 'invalid frontmatter', parsed.error.issues);
    }
    let dirExists = false;
    try {
      await stat(dir);
      dirExists = true;
    } catch {
      // missing — good
    }
    if (dirExists) throw new McpError('ALREADY_EXISTS', `skill "${input.name}" exists`);
    const support = input.supportingFiles ?? {};
    const supportPaths = Object.keys(support);
    supportPaths.forEach(checkSupportPath);
    if (supportPaths.length + 1 > MAX_DIR_ENTRIES) {
      throw new McpError('LIMIT_EXCEEDED', `supporting files exceed cap`);
    }
    if (input.dry_run === true) {
      return { path: dir, written: false, supportingFilesWritten: [] };
    }
    const skillMdPath = resolve(dir, 'SKILL.md');
    await atomicWrite(
      ctx.projectRoot,
      dir,
      skillMdPath,
      serializeMd(input.frontmatter, input.body),
    );
    for (const [p, content] of Object.entries(support)) {
      await atomicWrite(ctx.projectRoot, dir, resolve(dir, p), content);
    }
    return { path: dir, written: true, supportingFilesWritten: supportPaths };
  },

  async update(
    ctx: McpContext,
    input: {
      name: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
      merge?: boolean;
      supportingFiles?: Record<string, string | null>;
      dry_run?: boolean;
    },
  ): Promise<{
    path: string;
    written: boolean;
    supportingFilesAffected: { written: string[]; deleted: string[] };
  }> {
    checkName(input.name);
    const dir = skillDir(ctx.projectRoot, input.name);
    const skillMd = resolve(dir, 'SKILL.md');
    await assertSkillFile(ctx.projectRoot, dir, skillMd);
    let current: { frontmatter: Record<string, unknown>; body: string };
    try {
      const src = await readFile(skillMd, 'utf8');
      current = parseMd(src);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new McpError('NOT_FOUND', `skill "${input.name}" not found`);
      }
      throw new McpError('IO_ERROR', 'failed to read skill');
    }
    const nextFm =
      input.frontmatter === undefined
        ? current.frontmatter
        : input.merge === true
          ? { ...current.frontmatter, ...input.frontmatter }
          : input.frontmatter;
    const parsed = skillFrontmatter.safeParse(nextFm);
    if (!parsed.success) {
      throw new McpError('VALIDATION_FAILED', 'invalid frontmatter', parsed.error.issues);
    }
    const nextBody = input.body !== undefined ? input.body : current.body;
    const support = input.supportingFiles ?? {};
    Object.keys(support).forEach(checkSupportPath);
    const written: string[] = [];
    const deleted: string[] = [];
    if (input.dry_run === true) {
      Object.entries(support).forEach(([p, c]) => (c === null ? deleted : written).push(p));
      return { path: dir, written: false, supportingFilesAffected: { written, deleted } };
    }
    await atomicWrite(
      ctx.projectRoot,
      dir,
      resolve(dir, 'SKILL.md'),
      serializeMd(nextFm, nextBody),
    );
    for (const [p, content] of Object.entries(support)) {
      const target = resolve(dir, p);
      if (content === null) {
        try {
          await assertSkillFile(ctx.projectRoot, dir, target);
          await rm(target);
          deleted.push(p);
        } catch (e: unknown) {
          if (e instanceof McpError) throw e;
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
      } else {
        await atomicWrite(ctx.projectRoot, dir, target, content);
        written.push(p);
      }
    }
    return { path: dir, written: true, supportingFilesAffected: { written, deleted } };
  },

  async delete(
    ctx: McpContext,
    { name, dry_run }: { name: string; dry_run?: boolean },
  ): Promise<{ path: string; deleted: boolean }> {
    checkName(name);
    const dir = skillDir(ctx.projectRoot, name);
    await assertContainedPath({
      root: skillsDir(ctx.projectRoot),
      target: dir,
      boundaryRoot: ctx.projectRoot,
      message: 'skill escapes skills directory',
    });
    try {
      await stat(dir);
    } catch {
      throw new McpError('NOT_FOUND', `skill "${name}" not found`);
    }
    if (dry_run === true) return { path: dir, deleted: false };
    await rm(dir, { recursive: true });
    return { path: dir, deleted: true };
  },
};
