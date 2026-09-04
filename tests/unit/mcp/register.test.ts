import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  TOOL_DESCRIPTORS,
  RESOURCE_DESCRIPTORS,
  zodToMcpSchema,
} from '../../../src/mcp/register.js';
import { resolveContext } from '../../../src/mcp/context.js';

function descriptor(name: string): {
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
} {
  const d = TOOL_DESCRIPTORS.find((t) => t.name === name);
  if (!d) throw new Error(`tool not found: ${name}`);
  return d as never;
}

describe('register', () => {
  it('registers exactly 50 tools', () => {
    expect(TOOL_DESCRIPTORS).toHaveLength(50);
    const names = TOOL_DESCRIPTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(50); // no dupes
  });
  it('registers exactly 17 resources', () => {
    expect(RESOURCE_DESCRIPTORS).toHaveLength(17);
  });
  it('every read tool also registers as a Resource', () => {
    const reads = TOOL_DESCRIPTORS.filter((d) => d.resourceUri !== undefined);
    expect(reads.length).toBe(17);
  });
  it('exposes install / uninstall / installs_list / refresh as registered tools', () => {
    const names = new Set(TOOL_DESCRIPTORS.map((d) => d.name));
    expect(names.has('install')).toBe(true);
    expect(names.has('uninstall')).toBe(true);
    expect(names.has('installs_list')).toBe(true);
    expect(names.has('refresh')).toBe(true);
  });
});

describe('register — schema gate at the trust boundary', () => {
  it('add_mcp_server rejects shell-metacharacter command', () => {
    const r = descriptor('add_mcp_server').inputSchema.safeParse({
      name: 'evil',
      server: { command: 'evil; rm -rf /', args: [] },
    });
    expect(r.success).toBe(false);
  });

  it('add_mcp_server rejects unknown top-level server field', () => {
    const r = descriptor('add_mcp_server').inputSchema.safeParse({
      name: 'evil',
      server: { command: 'node', __proto__field: 'x' },
    });
    expect(r.success).toBe(false);
  });

  it('add_mcp_server accepts a valid stdio entry', () => {
    const r = descriptor('add_mcp_server').inputSchema.safeParse({
      name: 'gh',
      server: { type: 'stdio', command: 'npx', args: ['-y', 'gh-mcp'] },
    });
    expect(r.success).toBe(true);
  });

  it('update_hooks rejects matcher with embedded newline', () => {
    const r = descriptor('update_hooks').inputSchema.safeParse({
      hooks: {
        PreToolUse: [{ matcher: 'Bash\nrm -rf $HOME', command: 'echo safe' }],
      },
    });
    expect(r.success).toBe(false);
  });

  it('update_permissions rejects YAML-injection-shaped entry', () => {
    const r = descriptor('update_permissions').inputSchema.safeParse({
      allow: ['Bash(*)\nmalicious_key: value'],
    });
    expect(r.success).toBe(false);
  });
});

describe('zodToMcpSchema', () => {
  it('emits a draft-07 object schema without the $schema key', () => {
    const json = zodToMcpSchema(z.object({ name: z.string(), limit: z.number().optional() }));
    expect(json).not.toHaveProperty('$schema');
    expect(json).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' }, limit: { type: 'number' } },
      required: ['name'],
    });
  });
});

describe('RESOURCE_DESCRIPTORS — read delegates to the tool handler', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'am-'));
    await mkdir(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    await writeFile(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
      'utf8',
    );
    await writeFile(
      join(projectRoot, '.agentsmesh/rules/_root.md'),
      '---\nroot: true\ndescription: root\n---\n\nbody\n',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('mirrors the tool uri/name/description and returns the same payload as the tool', async () => {
    const resource = RESOURCE_DESCRIPTORS[0];
    if (resource === undefined) throw new Error('no resources registered');
    const tool = TOOL_DESCRIPTORS.find((d) => d.name === resource.name);
    if (tool === undefined) throw new Error(`tool not found: ${resource.name}`);
    expect(resource.name).toBe('list_rules');
    expect(resource.uri).toBe(tool.resourceUri);
    expect(resource.description).toBe(tool.description);

    const ctx = await resolveContext({ cwd: projectRoot });
    const viaResource = await resource.read(ctx, {});
    const viaTool = await tool.handler(ctx, {});
    expect(viaResource).toEqual(viaTool);
    expect(JSON.stringify(viaResource)).toContain('_root');
  });
});
