/**
 * Branch coverage for the `agentsmesh installs <subcommand>` namespace
 * dispatcher in `src/cli/commands/installs.ts`. Exercises:
 *   1. No subcommand argument → showHelp + empty data
 *   2. Empty-string subcommand → showHelp + empty data
 *   3. Unknown subcommand → exit 2 + did-you-mean hint
 *   4. `--global` flag flips the scope on the empty-data shape
 *
 * The happy path (`installs list`) is covered by `installs-list.test.ts`
 * and the integration suite.
 */

import { describe, it, expect } from 'vitest';
import { runInstalls } from '../../../../src/cli/commands/installs.js';

describe('runInstalls dispatcher branches', () => {
  it('returns showHelp with empty data when no subcommand is given', async () => {
    const result = await runInstalls({}, [], '/tmp/nonexistent');
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ scope: 'project', subcommand: 'list', installs: [] });
  });

  it('returns showHelp with empty data when subcommand is an empty string', async () => {
    const result = await runInstalls({}, [''], '/tmp/nonexistent');
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns exit 2 with did-you-mean error for an unknown subcommand', async () => {
    const result = await runInstalls({}, ['fake-sub'], '/tmp/nonexistent');
    expect(result.exitCode).toBe(2);
    expect(result.showHelp).toBe(true);
    expect(result.error).toContain('Unknown installs subcommand: "fake-sub"');
    expect(result.error).toContain('Did you mean `agentsmesh install fake-sub`');
  });

  it('honors --global on the empty-data scope', async () => {
    const result = await runInstalls({ global: true }, [], '/tmp/nonexistent');
    expect(result.data.scope).toBe('global');
  });
});
