import { readdir, readFile, stat, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { ZodType } from 'zod';
import type { McpContext } from '../context.js';
import { McpError } from '../errors.js';
import { MAX_DIR_ENTRIES } from '../limits.js';
import { safeWrite } from '../writers/safe-write.js';
import { parseMd, serializeMd } from '../writers/md-frontmatter.js';

// Flat identifier only — `/` is intentionally excluded so canonical names
// cannot create hidden subdirectory layouts that `list` does not surface.
const NAME_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/;
const PROTECTED_NAMES: Record<string, string> = { rules: '_root' };

export type CanonicalFeature = 'rules' | 'commands' | 'agents';

export interface CanonicalFactoryOpts<TSummary> {
  feature: CanonicalFeature;
  frontmatterSchema: ZodType<unknown>;
  toSummary: (name: string, frontmatter: Record<string, unknown>) => TSummary;
}

export interface CanonicalHandlers<TSummary> {
  list(ctx: McpContext): Promise<TSummary[]>;
  get(
    ctx: McpContext,
    input: { name: string },
  ): Promise<{ name: string; frontmatter: Record<string, unknown>; body: string }>;
  create(
    ctx: McpContext,
    input: { name: string; frontmatter: Record<string, unknown>; body: string; dry_run?: boolean },
  ): Promise<{ path: string; written: boolean }>;
  update(
    ctx: McpContext,
    input: {
      name: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
      merge?: boolean;
      dry_run?: boolean;
    },
  ): Promise<{ path: string; written: boolean }>;
  delete(
    ctx: McpContext,
    input: { name: string; force?: boolean; dry_run?: boolean },
  ): Promise<{ path: string; deleted: boolean }>;
}

function checkName(name: string): void {
  if (!NAME_RE.test(name) || name.includes('..')) {
    throw new McpError('INVALID_NAME', `invalid name: ${name}`);
  }
}

function pathFor(projectRoot: string, feature: string, name: string): string {
  return resolve(projectRoot, '.agentsmesh', feature, `${name}.md`);
}

export function createCanonicalHandlers<TSummary>(
  opts: CanonicalFactoryOpts<TSummary>,
): CanonicalHandlers<TSummary> {
  const { feature, frontmatterSchema, toSummary } = opts;
  const featureDir = (root: string): string => resolve(root, '.agentsmesh', feature);

  async function listFiles(root: string): Promise<string[]> {
    try {
      const entries = await readdir(featureDir(root), { withFileTypes: true });
      return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async function exists(file: string): Promise<boolean> {
    try {
      await stat(file);
      return true;
    } catch {
      return false;
    }
  }

  return {
    async list(ctx) {
      const files = await listFiles(ctx.projectRoot);
      const out: TSummary[] = [];
      for (const f of files) {
        const name = f.replace(/\.md$/, '');
        const src = await readFile(join(featureDir(ctx.projectRoot), f), 'utf8');
        const { frontmatter } = parseMd(src);
        out.push(toSummary(name, frontmatter));
      }
      return out;
    },

    async get(ctx, { name }) {
      checkName(name);
      const file = pathFor(ctx.projectRoot, feature, name);
      try {
        const src = await readFile(file, 'utf8');
        const { frontmatter, body } = parseMd(src);
        return { name, frontmatter, body };
      } catch (e: unknown) {
        const errno = (e as NodeJS.ErrnoException).code;
        if (errno === 'ENOENT') {
          throw new McpError('NOT_FOUND', `${feature} "${name}" not found`);
        }
        throw new McpError('IO_ERROR', `failed to read ${feature}`, { errno });
      }
    },

    async create(ctx, { name, frontmatter, body, dry_run }) {
      checkName(name);
      const parsed = frontmatterSchema.safeParse(frontmatter);
      if (!parsed.success) {
        throw new McpError('VALIDATION_FAILED', 'invalid frontmatter', parsed.error.issues);
      }
      const file = pathFor(ctx.projectRoot, feature, name);
      if (await exists(file)) throw new McpError('ALREADY_EXISTS', `${feature} "${name}" exists`);
      const all = await listFiles(ctx.projectRoot);
      if (all.length >= MAX_DIR_ENTRIES) {
        throw new McpError('LIMIT_EXCEEDED', `${feature} dir at ${MAX_DIR_ENTRIES} entries`);
      }
      const content = serializeMd(frontmatter, body);
      if (dry_run === true) return { path: file, written: false };
      await safeWrite({
        projectRoot: ctx.projectRoot,
        feature,
        relativePath: `${name}.md`,
        content,
      });
      return { path: file, written: true };
    },

    async update(ctx, { name, frontmatter, body, merge, dry_run }) {
      checkName(name);
      const file = pathFor(ctx.projectRoot, feature, name);
      let current: { frontmatter: Record<string, unknown>; body: string };
      try {
        const src = await readFile(file, 'utf8');
        current = parseMd(src);
      } catch (e: unknown) {
        const errno = (e as NodeJS.ErrnoException).code;
        if (errno === 'ENOENT') {
          throw new McpError('NOT_FOUND', `${feature} "${name}" not found`);
        }
        throw new McpError('IO_ERROR', `failed to read ${feature}`, { errno });
      }
      const nextFm =
        frontmatter === undefined
          ? current.frontmatter
          : merge === true
            ? { ...current.frontmatter, ...frontmatter }
            : frontmatter;
      const parsed = frontmatterSchema.safeParse(nextFm);
      if (!parsed.success) {
        throw new McpError('VALIDATION_FAILED', 'invalid frontmatter', parsed.error.issues);
      }
      const nextBody = body !== undefined ? body : current.body;
      const content = serializeMd(nextFm, nextBody);
      if (dry_run === true) return { path: file, written: false };
      await safeWrite({
        projectRoot: ctx.projectRoot,
        feature,
        relativePath: `${name}.md`,
        content,
      });
      return { path: file, written: true };
    },

    async delete(ctx, { name, force, dry_run }) {
      checkName(name);
      if (PROTECTED_NAMES[feature] === name && force !== true) {
        throw new McpError('PROTECTED_FILE', `${feature} "${name}" requires force: true`);
      }
      const file = pathFor(ctx.projectRoot, feature, name);
      if (!(await exists(file))) throw new McpError('NOT_FOUND', `${feature} "${name}" not found`);
      if (dry_run === true) return { path: file, deleted: false };
      await rm(file);
      return { path: file, deleted: true };
    },
  };
}
