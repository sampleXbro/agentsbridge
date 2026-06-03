import { describe, it, expect } from 'vitest';
import { parseIndex } from '../../../src/lessons/index-schema.js';

const goodCluster = {
  topic: 'foo',
  file: '.agentsmesh/lessons/topics/foo.md',
  summary: 'covers foo',
  triggers: { file_globs: ['src/**'], command_patterns: [], keywords: [] },
};

describe('parseIndex', () => {
  it('accepts a minimal valid index', () => {
    const parsed = parseIndex({ version: 1, clusters: [goodCluster] });
    expect(parsed.clusters[0]?.topic).toBe('foo');
    expect(parsed.clusters[0]?.file).toBe('.agentsmesh/lessons/topics/foo.md');
  });

  it('accepts an empty clusters array (fresh init)', () => {
    const parsed = parseIndex({ version: 1, clusters: [] });
    expect(parsed.clusters).toEqual([]);
  });

  it('rejects empty trigger lists across all types', () => {
    expect(() =>
      parseIndex({
        version: 1,
        clusters: [
          { ...goodCluster, triggers: { file_globs: [], command_patterns: [], keywords: [] } },
        ],
      }),
    ).toThrow(/at least one trigger/i);
  });

  it('rejects a file path that does not end in .md', () => {
    expect(() =>
      parseIndex({ version: 1, clusters: [{ ...goodCluster, file: 'something.txt' }] }),
    ).toThrow(/\.md/);
  });

  it('rejects topic with uppercase letters', () => {
    expect(() =>
      parseIndex({ version: 1, clusters: [{ ...goodCluster, topic: 'Foo' }] }),
    ).toThrow();
  });

  it('rejects a missing version field', () => {
    expect(() => parseIndex({ clusters: [goodCluster] })).toThrow();
  });
});
