import { describe, expect, it } from 'vitest';
import {
  buildInstalledList,
  buildSkippedList,
} from '../../../src/install/run/run-install-result.js';

describe('run install result builders', () => {
  it('builds installed entries for every selected resource kind', () => {
    const installed = buildInstalledList(
      {
        skillNames: ['review'],
        ruleSlugs: ['typescript'],
        commandNames: ['ship'],
        agentNames: ['planner'],
      },
      'pack-a',
    );

    expect(installed).toEqual([
      { kind: 'skill', name: 'review', path: 'pack-a' },
      { kind: 'rule', name: 'typescript', path: 'pack-a' },
      { kind: 'command', name: 'ship', path: 'pack-a' },
      { kind: 'agent', name: 'planner', path: 'pack-a' },
    ]);
  });

  it('skips unselected resources and keeps selected resources out of skipped output', () => {
    const skipped = buildSkippedList(
      [{ name: 'review' }, { name: 'docs' }],
      [
        { source: '/repo/.agentsmesh/rules/typescript.md' },
        { source: '/repo/.agentsmesh/rules/go.md' },
      ],
      [{ name: 'ship' }, { name: 'deploy' }],
      [{ name: 'planner' }, { name: 'debugger' }],
      {
        skillNames: ['review'],
        ruleSlugs: ['typescript'],
        commandNames: ['ship'],
        agentNames: ['planner'],
      },
    );

    expect(skipped).toEqual([
      { kind: 'skill', name: 'docs', reason: 'conflict' },
      { kind: 'rule', name: 'go', reason: 'conflict' },
      { kind: 'command', name: 'deploy', reason: 'conflict' },
      { kind: 'agent', name: 'debugger', reason: 'conflict' },
    ]);
  });
});
