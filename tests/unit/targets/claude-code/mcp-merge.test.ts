import { describe, expect, it } from 'vitest';
import { mergeClaudeMcpJson } from '../../../../src/targets/claude-code/mcp-merge.js';

const GENERATED = JSON.stringify({ mcpServers: { fetch: { command: 'npx' } } });

describe('mergeClaudeMcpJson', () => {
  it('declines paths it does not own', () => {
    expect(mergeClaudeMcpJson('{}', undefined, GENERATED, '.claude/settings.json')).toBeNull();
  });

  it('declines when there is no base file', () => {
    expect(mergeClaudeMcpJson(null, undefined, GENERATED, '.mcp.json')).toBeNull();
  });

  it('keeps unrelated keys in the project .mcp.json', () => {
    expect(mergeClaudeMcpJson('{"$schema":"s"}', undefined, GENERATED, '.mcp.json')).toBe(
      JSON.stringify({ $schema: 's', mcpServers: { fetch: { command: 'npx' } } }, null, 2),
    );
  });

  it('keeps global .claude.json account and project state', () => {
    const existing = JSON.stringify({ oauthAccount: { accountUuid: 'a' }, projects: {} });
    expect(mergeClaudeMcpJson(existing, undefined, GENERATED, '.claude.json')).toBe(
      JSON.stringify(
        {
          oauthAccount: { accountUuid: 'a' },
          projects: {},
          mcpServers: { fetch: { command: 'npx' } },
        },
        null,
        2,
      ),
    );
  });
});
