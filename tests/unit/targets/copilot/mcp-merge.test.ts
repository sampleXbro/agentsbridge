import { describe, expect, it } from 'vitest';
import { mergeCopilotMcpJson } from '../../../../src/targets/copilot/mcp-merge.js';
import type { GenerateResult } from '../../../../src/core/types.js';

const GENERATED = JSON.stringify({ servers: { fetch: { command: 'npx' } } });
const PATH = '.vscode/mcp.json';

describe('mergeCopilotMcpJson', () => {
  it('declines paths it does not own', () => {
    expect(mergeCopilotMcpJson('{}', undefined, GENERATED, '.copilot/mcp-config.json')).toBeNull();
  });

  it('declines when there is no base file', () => {
    expect(mergeCopilotMcpJson(null, undefined, GENERATED, PATH)).toBeNull();
  });

  it('keeps the inputs array and revokes servers removed from canonical', () => {
    const existing = JSON.stringify({ inputs: [{ id: 'tok' }], servers: { stale: {} } });
    expect(mergeCopilotMcpJson(existing, undefined, GENERATED, PATH)).toBe(
      JSON.stringify({ inputs: [{ id: 'tok' }], servers: { fetch: { command: 'npx' } } }, null, 2),
    );
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending: GenerateResult = {
      target: 'copilot',
      path: PATH,
      content: JSON.stringify({ inputs: ['from-pending'] }),
      status: 'updated',
    };
    expect(mergeCopilotMcpJson('{"inputs":["from-disk"]}', pending, GENERATED, PATH)).toBe(
      JSON.stringify({ inputs: ['from-pending'], servers: { fetch: { command: 'npx' } } }, null, 2),
    );
  });
});
