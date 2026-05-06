import { describe, it, expect } from 'vitest';
import { TEMPLATE_MCP } from '../../../../src/cli/commands/init-templates.js';

describe('TEMPLATE_MCP', () => {
  it('seeds the agentsmesh entry uncommented', () => {
    expect(TEMPLATE_MCP).toMatch(/"agentsmesh":\s*\{/);
    expect(TEMPLATE_MCP).toMatch(/"command":\s*"npx"/);
    expect(TEMPLATE_MCP).toMatch(/"args":\s*\["-y",\s*"agentsmesh",\s*"mcp"\]/);
  });
  it('keeps github + filesystem examples commented', () => {
    expect(TEMPLATE_MCP).toMatch(/\/\/\s*"github"/);
    expect(TEMPLATE_MCP).toMatch(/\/\/\s*"filesystem"/);
  });
  it('docs reference points to the MCP server page', () => {
    expect(TEMPLATE_MCP).toContain('reference/mcp-server');
  });
});
