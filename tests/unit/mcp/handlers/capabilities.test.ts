import { describe, it, expect } from 'vitest';
import { capabilitiesHandlers } from '../../../../src/mcp/handlers/capabilities.js';

describe('capabilitiesHandlers', () => {
  it('lists all targets from SUPPORT_MATRIX', async () => {
    const all = await capabilitiesHandlers.list();
    expect(Object.keys(all).length).toBeGreaterThan(10);
    expect(all['claude-code']).toBeDefined();
  });
  it('returns one target', async () => {
    const cc = await capabilitiesHandlers.get({ targetId: 'claude-code' });
    expect(cc.targetId).toBe('claude-code');
  });
  it('throws NOT_FOUND for unknown', async () => {
    await expect(capabilitiesHandlers.get({ targetId: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
