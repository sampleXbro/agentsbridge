import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readResource } from '../../../src/mcp/resources.js';
import type { ResourceDescriptor } from '../../../src/mcp/tool-tables/types.js';
import type { McpContext } from '../../../src/mcp/context.js';

const ctx: McpContext = { projectRoot: '/repo', loadCanonical: async () => ({}) as never };

function descriptors(read: ResourceDescriptor['read']): ResourceDescriptor[] {
  return [
    {
      uri: 'a://skills/{name}/files/{path}',
      name: 'skill_file',
      description: 'x',
      inputSchema: z.object({ name: z.string().min(1), path: z.string().regex(/^[^.]/) }),
      read,
    },
  ];
}

describe('readResource', () => {
  it('validates template params through the descriptor schema before reading', async () => {
    const list = descriptors(async () => 'never');
    await expect(readResource(list, 'a://skills/foo/files/../etc', ctx)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('passes validated params to read', async () => {
    const list = descriptors(async (_c, params) => params);
    await expect(readResource(list, 'a://skills/foo/files/ref/x.md', ctx)).resolves.toEqual({
      name: 'foo',
      path: 'ref/x.md',
    });
  });

  it('prefers the most specific template when several match', async () => {
    const list: ResourceDescriptor[] = [
      {
        uri: 'a://skills/{name}',
        name: 'skill',
        description: 'x',
        inputSchema: z.object({ name: z.string() }),
        read: async (_c, params) => ({ via: 'skill', ...params }),
      },
      ...descriptors(async (_c, params) => ({ via: 'file', ...params })),
    ];
    await expect(readResource(list, 'a://skills/foo/files/ref/x.md', ctx)).resolves.toEqual({
      via: 'file',
      name: 'foo',
      path: 'ref/x.md',
    });
    await expect(readResource(list, 'a://skills/foo', ctx)).resolves.toEqual({
      via: 'skill',
      name: 'foo',
    });
  });

  it('rejects unknown URIs with NOT_FOUND', async () => {
    await expect(
      readResource(
        descriptors(async () => 1),
        'a://nope',
        ctx,
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('wraps raw errors as IO_ERROR with absolute paths redacted', async () => {
    const list = descriptors(async () => {
      throw new Error(
        "EACCES: permission denied, open '/private/var/repo/.agentsmesh/rules/_root.md'",
      );
    });
    await expect(readResource(list, 'a://skills/foo/files/x.md', ctx)).rejects.toMatchObject({
      code: 'IO_ERROR',
      message: expect.not.stringContaining('/private/var'),
    });
  });
});
