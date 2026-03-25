import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '../../../src/cli/router.js';

describe('createRouter', () => {
  it('routes known command to handler', async () => {
    const handler = vi.fn();
    const router = createRouter({ generate: handler });
    await router.route('generate', {}, []);
    expect(handler).toHaveBeenCalledWith({}, []);
  });

  it('throws on unknown command with suggestion', async () => {
    const router = createRouter({ generate: vi.fn() });
    await expect(router.route('genrate', {}, [])).rejects.toThrow(/unknown command.*genrate/i);
  });

  it('lists available commands', () => {
    const router = createRouter({
      generate: vi.fn(),
      import: vi.fn(),
    });
    expect(router.commands()).toEqual(['generate', 'import']);
  });
});
