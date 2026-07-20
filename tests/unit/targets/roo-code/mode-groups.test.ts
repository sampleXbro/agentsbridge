import { describe, it, expect } from 'vitest';
import {
  mapAgentToolsToRooGroups,
  ROO_CODE_DEFAULT_MODE_GROUPS,
} from '../../../../src/targets/roo-code/mode-groups.js';

describe('mapAgentToolsToRooGroups', () => {
  it('defaults to the safe permissive set when tools is empty', () => {
    expect(mapAgentToolsToRooGroups({ tools: [] })).toEqual([...ROO_CODE_DEFAULT_MODE_GROUPS]);
  });

  it('maps read-like tools to the read group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['Read', 'Grep', 'Glob'] })).toEqual(['read']);
  });

  it('maps write/edit-like tools to the edit group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['Write', 'Edit'] })).toEqual(['edit']);
  });

  it('maps shell-like tools to the command group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['Bash'] })).toEqual(['command']);
  });

  it('maps mcp-like tools to the mcp group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['mcp__github__create_issue'] })).toEqual(['mcp']);
  });

  it('dedupes and orders groups in a stable canonical order', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['Bash', 'Read', 'Write', 'Bash'] })).toEqual([
      'read',
      'edit',
      'command',
    ]);
  });

  it('falls back to the safe permissive set when no tool maps to a known group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['SomeUnknownTool'] })).toEqual([
      ...ROO_CODE_DEFAULT_MODE_GROUPS,
    ]);
  });

  it('maps mode-control tools (switch_mode/new_task) to the modes group', () => {
    expect(mapAgentToolsToRooGroups({ tools: ['switch_mode'] })).toEqual(['modes']);
    expect(mapAgentToolsToRooGroups({ tools: ['new_task'] })).toEqual(['modes']);
  });
});
