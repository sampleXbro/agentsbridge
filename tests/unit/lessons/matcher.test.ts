import { describe, it, expect } from 'vitest';
import { matchTriggers } from '../../../src/lessons/matcher.js';
import type { LessonsCluster } from '../../../src/lessons/index-schema.js';

const cluster: LessonsCluster = {
  topic: 'windows-paths',
  file: '.agentsmesh/lessons/topics/windows-paths.md',
  summary: 'x',
  triggers: {
    file_globs: ['src/**/path*.ts', 'tests/**/*windows*'],
    command_patterns: ['^pnpm build$'],
    keywords: ['windows', 'realpath'],
  },
};

describe('matchTriggers', () => {
  it('matches a file_glob against an edit/write file path', () => {
    expect(
      matchTriggers([cluster], { kind: 'edit', filePath: 'src/utils/path-helpers.ts' }),
    ).toEqual([cluster]);
  });

  it('matches a file_glob against a write event', () => {
    expect(
      matchTriggers([cluster], { kind: 'write', filePath: 'tests/unit/windows-foo.test.ts' }),
    ).toEqual([cluster]);
  });

  it('matches a command_pattern (regex) against a Bash command', () => {
    expect(matchTriggers([cluster], { kind: 'bash', command: 'pnpm build' })).toEqual([cluster]);
  });

  it('matches a keyword (case-insensitive substring) against task description', () => {
    expect(matchTriggers([cluster], { kind: 'task', text: 'Fix Windows runner flake' })).toEqual([
      cluster,
    ]);
  });

  it('returns [] when no triggers match', () => {
    expect(matchTriggers([cluster], { kind: 'edit', filePath: 'docs/readme.md' })).toEqual([]);
  });

  it('returns multiple clusters when several match', () => {
    const c2: LessonsCluster = {
      ...cluster,
      topic: 'b',
      file: '.agentsmesh/lessons/topics/b.md',
      triggers: { file_globs: ['src/**'], command_patterns: [], keywords: [] },
    };
    expect(
      matchTriggers([cluster, c2], { kind: 'edit', filePath: 'src/utils/path.ts' }),
    ).toHaveLength(2);
  });

  it('treats invalid command_pattern regex as no-match (does not throw)', () => {
    const broken: LessonsCluster = {
      ...cluster,
      topic: 'broken',
      file: '.agentsmesh/lessons/topics/broken.md',
      triggers: { file_globs: [], command_patterns: ['['], keywords: [] },
    };
    expect(matchTriggers([broken], { kind: 'bash', command: 'anything' })).toEqual([]);
  });
});
