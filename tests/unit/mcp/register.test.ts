import { describe, it, expect } from 'vitest';
import { TOOL_DESCRIPTORS, RESOURCE_DESCRIPTORS } from '../../../src/mcp/register.js';

describe('register', () => {
  it('registers exactly 41 tools', () => {
    expect(TOOL_DESCRIPTORS).toHaveLength(41);
    const names = TOOL_DESCRIPTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(41); // no dupes
  });
  it('registers exactly 16 resources', () => {
    expect(RESOURCE_DESCRIPTORS).toHaveLength(16);
  });
  it('every read tool also registers as a Resource', () => {
    const reads = TOOL_DESCRIPTORS.filter((d) => d.resourceUri !== undefined);
    expect(reads.length).toBe(16);
  });
});
