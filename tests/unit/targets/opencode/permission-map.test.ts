import { describe, it, expect } from 'vitest';
import {
  mapAgentToolsToOpenCodePermission,
  mapOpenCodePermissionToAgentTools,
} from '../../../../src/targets/opencode/permission-map.js';

describe('mapAgentToolsToOpenCodePermission', () => {
  it('returns an empty object when neither tools nor disallowedTools are set', () => {
    expect(mapAgentToolsToOpenCodePermission({ tools: [], disallowedTools: [] })).toEqual({});
  });

  it('sets "*": deny and allows classified categories when tools is an allow-list', () => {
    expect(
      mapAgentToolsToOpenCodePermission({
        tools: ['Read', 'Grep', 'WebSearch'],
        disallowedTools: [],
      }),
    ).toEqual({ '*': 'deny', read: 'allow', grep: 'allow', websearch: 'allow' });
  });

  it('denies classified categories from disallowedTools without an allow-list', () => {
    expect(
      mapAgentToolsToOpenCodePermission({ tools: [], disallowedTools: ['Bash', 'Edit'] }),
    ).toEqual({ bash: 'deny', edit: 'deny' });
  });

  it('disallowedTools takes precedence over tools for the same category', () => {
    expect(
      mapAgentToolsToOpenCodePermission({ tools: ['Bash'], disallowedTools: ['Bash'] }),
    ).toEqual({ '*': 'deny', bash: 'deny' });
  });

  it('ignores tool names that classify to no known category', () => {
    expect(
      mapAgentToolsToOpenCodePermission({ tools: ['MysteryTool'], disallowedTools: [] }),
    ).toEqual({ '*': 'deny' });
  });

  it('classifies NotebookEdit and Write as edit', () => {
    expect(
      mapAgentToolsToOpenCodePermission({ tools: [], disallowedTools: ['Write', 'NotebookEdit'] }),
    ).toEqual({ edit: 'deny' });
  });
});

describe('mapOpenCodePermissionToAgentTools', () => {
  it('returns empty lists for non-object input', () => {
    expect(mapOpenCodePermissionToAgentTools(null)).toEqual({ tools: [], disallowedTools: [] });
    expect(mapOpenCodePermissionToAgentTools('deny')).toEqual({ tools: [], disallowedTools: [] });
    expect(mapOpenCodePermissionToAgentTools(['deny'])).toEqual({ tools: [], disallowedTools: [] });
  });

  it('maps deny entries to disallowedTools regardless of allow-list mode', () => {
    expect(mapOpenCodePermissionToAgentTools({ bash: 'deny', webfetch: 'deny' })).toEqual({
      tools: [],
      disallowedTools: ['bash', 'webfetch'],
    });
  });

  it('maps allow entries to tools only when "*" is deny (allow-list mode)', () => {
    expect(
      mapOpenCodePermissionToAgentTools({ '*': 'deny', read: 'allow', grep: 'allow' }),
    ).toEqual({
      tools: ['read', 'grep'],
      disallowedTools: [],
    });
  });

  it('does not populate tools from a bare allow entry without "*": deny', () => {
    expect(mapOpenCodePermissionToAgentTools({ edit: 'allow' })).toEqual({
      tools: [],
      disallowedTools: [],
    });
  });

  it('ignores "ask" entries (no canonical bucket for them)', () => {
    expect(mapOpenCodePermissionToAgentTools({ bash: 'ask' })).toEqual({
      tools: [],
      disallowedTools: [],
    });
  });

  it('round-trips a generator-produced permission object back to its tool lists (categorical, not original casing)', () => {
    const permission = mapAgentToolsToOpenCodePermission({
      tools: ['Read', 'Grep'],
      disallowedTools: ['Bash'],
    });
    expect(mapOpenCodePermissionToAgentTools(permission)).toEqual({
      tools: ['read', 'grep'],
      disallowedTools: ['bash'],
    });
  });
});
