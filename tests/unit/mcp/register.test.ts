import { describe, it, expect } from 'vitest';
import { TOOL_DESCRIPTORS, RESOURCE_DESCRIPTORS } from '../../../src/mcp/register.js';

function descriptor(name: string): {
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
} {
  const d = TOOL_DESCRIPTORS.find((t) => t.name === name);
  if (!d) throw new Error(`tool not found: ${name}`);
  return d as never;
}

describe('register', () => {
  it('registers exactly 48 tools', () => {
    expect(TOOL_DESCRIPTORS).toHaveLength(48);
    const names = TOOL_DESCRIPTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(48); // no dupes
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
