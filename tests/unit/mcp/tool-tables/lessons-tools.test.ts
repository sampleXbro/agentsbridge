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

describe('lessons curation tools are registered', () => {
  it('exposes lessons_deprecate and lessons_show alongside query/add/topics', () => {
    const names = LESSONS_TOOL_DESCRIPTORS.map((d) => d.name).sort();
    expect(names).toEqual(
      ['lessons_add', 'lessons_deprecate', 'lessons_query', 'lessons_show', 'lessons_topics'].sort(),
    );
  });

  it('lessons_deprecate requires an id and accepts an optional superseded_by', () => {
    const d = LESSONS_TOOL_DESCRIPTORS.find((x) => x.name === 'lessons_deprecate');
    if (d === undefined) throw new Error('lessons_deprecate descriptor missing');
    expect(d.inputSchema.safeParse({ id: 'a-rule' }).success).toBe(true);
    expect(d.inputSchema.safeParse({ id: 'a-rule', superseded_by: 'b-rule' }).success).toBe(true);
    expect(d.inputSchema.safeParse({}).success).toBe(false);
    expect(d.inputSchema.safeParse({ id: 'a', bogus: 1 }).success).toBe(false);
  });

  it('lessons_show requires a topic', () => {
    const d = LESSONS_TOOL_DESCRIPTORS.find((x) => x.name === 'lessons_show');
    if (d === undefined) throw new Error('lessons_show descriptor missing');
    expect(d.inputSchema.safeParse({ topic: 'topic-x' }).success).toBe(true);
    expect(d.inputSchema.safeParse({}).success).toBe(false);
  });
});

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
