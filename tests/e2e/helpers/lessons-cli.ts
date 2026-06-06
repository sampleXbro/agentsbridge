/**
 * Shared E2E helper for the `agentsmesh lessons` CLI tests: add a lesson via the
 * real binary (argv array preserves spaced rule/summary values) and return its id.
 */

import { expect } from 'vitest';
import { runCliArgs } from './run-cli.js';

export interface AddLessonOpts {
  topic: string;
  newTopic?: boolean;
  summary?: string;
  extra?: string[];
}

export async function addLessonCli(
  dir: string,
  rule: string,
  opts: AddLessonOpts,
): Promise<string> {
  const args = ['lessons', 'add', rule, '--topic', opts.topic];
  if (opts.newTopic === true)
    args.push('--new-topic', '--topic-summary', opts.summary ?? 'summary');
  if (opts.extra) args.push(...opts.extra);
  args.push('--json');
  const r = await runCliArgs(args, dir);
  expect(r.exitCode).toBe(0);
  const env = JSON.parse(r.stdout) as { data: { id: string } };
  return env.data.id;
}
