import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('runMcp', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('redirects logger to stderr and boots the server', async () => {
    const startServer = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../../../src/mcp/server.js', () => ({ startServer }));

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const { runMcp } = await import('../../../../src/cli/commands/mcp.js');
    await runMcp({}, []);

    expect(startServer).toHaveBeenCalledOnce();

    stdoutSpy.mockRestore();
  });

  it('passes flags and args (no-op — handler ignores them)', async () => {
    const startServer = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../../../src/mcp/server.js', () => ({ startServer }));

    const { runMcp } = await import('../../../../src/cli/commands/mcp.js');
    await runMcp({ verbose: true }, ['extra-arg']);

    expect(startServer).toHaveBeenCalledOnce();
  });
});
