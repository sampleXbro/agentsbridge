import { describe, expect, it } from 'vitest';
import { doAdd } from '../../../src/cli/commands/lessons-write-handlers.js';

/**
 * The add handler rejects an under-specified capture before touching the graph,
 * so these cases never read the filesystem — the projectRoot is irrelevant. The
 * error must echo a copy-pasteable invocation so a fresh agent self-corrects in
 * one shot instead of guessing at the missing flag.
 */
describe('doAdd — error hints carry a worked example', () => {
  it('missing --topic returns usage + example', async () => {
    const res = await doAdd({}, 'Some imperative rule', '/tmp/unused-amesh-root');
    expect(res.exitCode).toBe(2);
    expect(res.error).toContain('--topic');
    expect(res.error).toContain('Example:');
    expect(res.error).toContain('agentsmesh lessons add');
  });

  it('missing rule returns usage + example', async () => {
    const res = await doAdd({}, undefined, '/tmp/unused-amesh-root');
    expect(res.exitCode).toBe(2);
    expect(res.error).toContain('Example:');
    expect(res.error).toContain('--topic');
  });
});
