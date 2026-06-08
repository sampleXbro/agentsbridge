import { describe, expect, it } from 'vitest';
import { LESSONS_TOOL_DESCRIPTORS } from '../../../../src/mcp/tool-tables/lessons-tools.js';

/**
 * Schema-layer parity: the `lessons_add` input schema must accept the same
 * tolerant shapes the CLI does — a bare string for a list field, and the CLI
 * flag-name aliases — so an agent reaching for the MCP tool with CLI muscle
 * memory is not rejected before the handler even runs.
 */
const addSchema = (() => {
  const d = LESSONS_TOOL_DESCRIPTORS.find((x) => x.name === 'lessons_add');
  if (d === undefined) throw new Error('lessons_add descriptor missing');
  return d.inputSchema;
})();

describe('lessons_add input schema tolerance', () => {
  it('accepts a scalar string for a trigger list field', () => {
    expect(addSchema.safeParse({ rule: 'R.', topic: 't', trigger_files: 'src/**' }).success).toBe(
      true,
    );
  });

  it('still accepts arrays for trigger list fields', () => {
    expect(
      addSchema.safeParse({ rule: 'R.', topic: 't', trigger_files: ['src/**'] }).success,
    ).toBe(true);
  });

  it('accepts a scalar evidence string', () => {
    expect(addSchema.safeParse({ rule: 'R.', topic: 't', evidence: 'commit:abc' }).success).toBe(
      true,
    );
  });

  it('accepts the CLI-flag aliases trigger_file / trigger_cmd / trigger_kw', () => {
    expect(
      addSchema.safeParse({
        rule: 'R.',
        topic: 't',
        trigger_file: 'src/**',
        trigger_cmd: '^pnpm',
        trigger_kw: 'win',
      }).success,
    ).toBe(true);
  });

  it('still rejects a genuinely unknown key (strict object preserved)', () => {
    expect(
      addSchema.safeParse({ rule: 'R.', topic: 't', bogus_field: 'x' }).success,
    ).toBe(false);
  });
});
