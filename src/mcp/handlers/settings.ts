import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolve } from 'node:path';
import { readFile, writeFile, rename } from 'node:fs/promises';
import type { McpContext } from '../context.js';
import { McpError } from '../errors.js';
import { MAX_FILE_SIZE_BYTES } from '../limits.js';
import { safeConfigWrite } from '../writers/safe-config-write.js';
import { assertContainedPath } from '../writers/path-containment.js';
import { normalizeHooksRecord } from '../writers/normalize-hooks.js';
import { configSchema } from '../../config/core/schema.js';
import { parseMcp } from '../../canonical/features/mcp.js';
import type { McpConfig } from '../../core/mcp-types.js';

// Reject any config read/write whose resolved (symlink-followed) path escapes
// the project root — a symlinked config file OR a symlinked `.agentsmesh` parent
// dir must not leak or overwrite files outside the project. Anchoring at the
// project root (not `.agentsmesh`) is deliberate: a boundary of `.agentsmesh`
// would canonicalize through a symlinked `.agentsmesh` and cancel.
async function assertWithinProject(projectRoot: string, target: string): Promise<void> {
  await assertContainedPath({
    root: projectRoot,
    target,
    message: 'config path escapes project directory',
  });
}

async function readYaml<T>(projectRoot: string, path: string): Promise<T | null> {
  await assertWithinProject(projectRoot, path);
  try {
    return parseYaml(await readFile(path, 'utf8')) as T;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new McpError('IO_ERROR', 'failed to read yaml');
  }
}

async function atomicWrite(projectRoot: string, path: string, content: string): Promise<void> {
  await assertWithinProject(projectRoot, path);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new McpError('LIMIT_EXCEEDED', 'file exceeds 1 MiB cap');
  }
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, path);
}

export const settingsHandlers = {
  // ─── reads ───

  async getConfig(ctx: McpContext): Promise<unknown> {
    const cfg = await readYaml<unknown>(
      ctx.projectRoot,
      resolve(ctx.projectRoot, 'agentsmesh.yaml'),
    );
    if (cfg === null) throw new McpError('NO_PROJECT', 'agentsmesh.yaml missing');
    return cfg;
  },

  async listMcpServers(ctx: McpContext): Promise<{ servers: McpConfig['mcpServers'] | null }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/mcp.json');
    await assertWithinProject(ctx.projectRoot, path);
    try {
      const cfg = await parseMcp(path);
      return { servers: cfg?.mcpServers ?? null };
    } catch {
      return { servers: null };
    }
  },

  async getPermissions(ctx: McpContext): Promise<unknown> {
    return (
      (await readYaml(ctx.projectRoot, resolve(ctx.projectRoot, '.agentsmesh/permissions.yaml'))) ??
      null
    );
  },

  async getHooks(ctx: McpContext): Promise<unknown> {
    return (
      (await readYaml(ctx.projectRoot, resolve(ctx.projectRoot, '.agentsmesh/hooks.yaml'))) ?? null
    );
  },

  async getIgnore(ctx: McpContext): Promise<{ patterns: string[] | null }> {
    const file = resolve(ctx.projectRoot, '.agentsmesh/ignore');
    await assertWithinProject(ctx.projectRoot, file);
    try {
      const src = await readFile(file, 'utf8');
      return { patterns: src.split(/\r?\n/).filter((l) => l !== '' && !l.startsWith('#')) };
    } catch {
      return { patterns: null };
    }
  },

  // ─── mutations ───

  async updateConfig(
    ctx: McpContext,
    input: {
      targets?: string[];
      features?: string[];
      conversions?: Record<string, unknown>;
      merge?: boolean;
      dry_run?: boolean;
      filename?: 'agentsmesh.yaml';
    },
  ): Promise<{ path: string; written: boolean }> {
    const current =
      (await readYaml<Record<string, unknown>>(
        ctx.projectRoot,
        resolve(ctx.projectRoot, 'agentsmesh.yaml'),
      )) ?? {};
    const next: Record<string, unknown> = { ...current };
    const apply = (k: 'targets' | 'features', v: string[] | undefined): void => {
      if (v === undefined) return;
      next[k] =
        input.merge === true && Array.isArray(current[k])
          ? Array.from(new Set([...(current[k] as string[]), ...v]))
          : v;
    };
    apply('targets', input.targets);
    apply('features', input.features);
    if (input.conversions !== undefined) {
      next.conversions =
        input.merge === true && current.conversions !== undefined
          ? { ...(current.conversions as object), ...input.conversions }
          : input.conversions;
    }
    const parsed = configSchema.safeParse(next);
    if (!parsed.success) {
      throw new McpError('VALIDATION_FAILED', 'invalid config', parsed.error.issues);
    }
    const yaml = stringifyYaml(next);
    if (input.dry_run === true) {
      return { path: resolve(ctx.projectRoot, 'agentsmesh.yaml'), written: false };
    }
    const path = await safeConfigWrite({
      projectRoot: ctx.projectRoot,
      content: yaml,
      filename: input.filename,
    });
    return { path, written: true };
  },

  async addMcpServer(
    ctx: McpContext,
    input: { name: string; server: Record<string, unknown>; dry_run?: boolean },
  ): Promise<{ path: string; written: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/mcp.json');
    await assertWithinProject(ctx.projectRoot, path);
    const cfg = (await parseMcp(path).catch(() => null)) ?? { mcpServers: {} };
    if (cfg.mcpServers[input.name] !== undefined) {
      throw new McpError('ALREADY_EXISTS', `server "${input.name}" exists`);
    }
    cfg.mcpServers[input.name] = input.server as never;
    if (input.dry_run === true) return { path, written: false };
    await atomicWrite(ctx.projectRoot, path, JSON.stringify(cfg, null, 2) + '\n');
    return { path, written: true };
  },

  async updateMcpServer(
    ctx: McpContext,
    input: { name: string; server: Record<string, unknown>; merge?: boolean; dry_run?: boolean },
  ): Promise<{ path: string; written: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/mcp.json');
    await assertWithinProject(ctx.projectRoot, path);
    const cfg = await parseMcp(path).catch(() => null);
    if (cfg === null || cfg.mcpServers[input.name] === undefined) {
      throw new McpError('NOT_FOUND', `server "${input.name}" not found`);
    }
    cfg.mcpServers[input.name] =
      input.merge === true
        ? ({ ...cfg.mcpServers[input.name], ...input.server } as never)
        : (input.server as never);
    if (input.dry_run === true) return { path, written: false };
    await atomicWrite(ctx.projectRoot, path, JSON.stringify(cfg, null, 2) + '\n');
    return { path, written: true };
  },

  async removeMcpServer(
    ctx: McpContext,
    input: { name: string; dry_run?: boolean },
  ): Promise<{ path: string; removed: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/mcp.json');
    await assertWithinProject(ctx.projectRoot, path);
    const cfg = await parseMcp(path).catch(() => null);
    if (cfg === null || cfg.mcpServers[input.name] === undefined) {
      throw new McpError('NOT_FOUND', `server "${input.name}" not found`);
    }
    delete cfg.mcpServers[input.name];
    if (input.dry_run === true) return { path, removed: false };
    await atomicWrite(ctx.projectRoot, path, JSON.stringify(cfg, null, 2) + '\n');
    return { path, removed: true };
  },

  async updatePermissions(
    ctx: McpContext,
    input: {
      allow?: string[];
      deny?: string[];
      ask?: string[];
      mode?: 'replace' | 'append';
      dry_run?: boolean;
    },
  ): Promise<{ path: string; written: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/permissions.yaml');
    const current = (await readYaml<{ allow?: string[]; deny?: string[]; ask?: string[] }>(
      ctx.projectRoot,
      path,
    )) ?? {
      allow: [],
      deny: [],
      ask: [],
    };
    const next = { ...current };
    const apply = (k: 'allow' | 'deny' | 'ask', v: string[] | undefined): void => {
      if (v === undefined) return;
      next[k] = input.mode === 'append' ? Array.from(new Set([...(current[k] ?? []), ...v])) : v;
    };
    apply('allow', input.allow);
    apply('deny', input.deny);
    apply('ask', input.ask);
    if (input.dry_run === true) return { path, written: false };
    await atomicWrite(ctx.projectRoot, path, stringifyYaml(next));
    return { path, written: true };
  },

  async updateHooks(
    ctx: McpContext,
    input: { hooks: Record<string, unknown[]>; dry_run?: boolean },
  ): Promise<{ path: string; written: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/hooks.yaml');
    if (input.dry_run === true) return { path, written: false };
    // Flatten the nested native form to the flat canonical shape so parseHooks
    // can recover it; a verbatim nested write is silently dropped on generate.
    await atomicWrite(ctx.projectRoot, path, stringifyYaml(normalizeHooksRecord(input.hooks)));
    return { path, written: true };
  },

  async updateIgnore(
    ctx: McpContext,
    input: { patterns: string[]; mode?: 'replace' | 'append'; dry_run?: boolean },
  ): Promise<{ path: string; written: boolean }> {
    const path = resolve(ctx.projectRoot, '.agentsmesh/ignore');
    let next: string[];
    if (input.mode === 'append') {
      await assertWithinProject(ctx.projectRoot, path);
      const cur = (await readFile(path, 'utf8').catch(() => '')).split(/\r?\n/).filter(Boolean);
      next = Array.from(new Set([...cur, ...input.patterns]));
    } else {
      next = input.patterns;
    }
    if (input.dry_run === true) return { path, written: false };
    await atomicWrite(ctx.projectRoot, path, next.join('\n') + '\n');
    return { path, written: true };
  },
};
