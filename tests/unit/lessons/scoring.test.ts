import { describe, it, expect } from 'vitest';
import { scoreBullet } from '../../../src/lessons/scoring.js';
import type { LessonsCluster } from '../../../src/lessons/index-schema.js';

const clusters: LessonsCluster[] = [
  {
    topic: 'windows-paths',
    file: '.agentsmesh/lessons/topics/windows-paths.md',
    summary: 'x',
    triggers: {
      file_globs: ['src/**/path*.ts'],
      command_patterns: [],
      keywords: ['windows', 'realpath'],
    },
  },
  {
    topic: 'shell-quoting',
    file: '.agentsmesh/lessons/topics/shell-quoting.md',
    summary: 'x',
    triggers: { file_globs: [], command_patterns: ['^rg '], keywords: ['backtick'] },
  },
];

describe('scoreBullet', () => {
  it('proposes windows-paths for a Windows path bullet', () => {
    const bullet = '- Windows runner failed on realpath divergence in src/utils/path-helpers.ts';
    expect(scoreBullet(bullet, clusters)[0]?.cluster.topic).toBe('windows-paths');
  });

  it('proposes shell-quoting for a backtick bullet', () => {
    const bullet = '- backtick inside double-quoted rg pattern executed pnpm build prematurely';
    expect(scoreBullet(bullet, clusters)[0]?.cluster.topic).toBe('shell-quoting');
  });

  it('returns [] when no cluster matches', () => {
    expect(scoreBullet('- unrelated lesson about typography', clusters)).toEqual([]);
  });

  it('sorts matched clusters by descending score', () => {
    const bullet = '- backtick inside windows realpath rg pattern broke build';
    const ranked = scoreBullet(bullet, clusters);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
  });

  it('treats invalid command_pattern regex as zero matches (does not throw)', () => {
    const broken: LessonsCluster[] = [
      {
        topic: 'broken',
        file: '.agentsmesh/lessons/topics/broken.md',
        summary: 'x',
        triggers: { file_globs: [], command_patterns: ['['], keywords: [] },
      },
    ];
    expect(scoreBullet('any text', broken)).toEqual([]);
  });

  it('ignores file_globs whose stem is too short to be discriminative', () => {
    const tiny: LessonsCluster[] = [
      {
        topic: 'tiny',
        file: '.agentsmesh/lessons/topics/tiny.md',
        summary: 'x',
        // After stripping glob chars and slashes, this stem is < 3 chars and must not match.
        triggers: { file_globs: ['**/a*'], command_patterns: [], keywords: [] },
      },
    ];
    expect(scoreBullet('- bullet mentioning a path', tiny)).toEqual([]);
  });
});
