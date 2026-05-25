/**
 * Step-1 coverage for the lenient-frontmatter install path.
 *
 * Mirrors the qdhenry/Claude-Command-Suite breakage observed during manual
 * round-2 testing: one command file with `argument-hint: [a] [b] [c]` trips a
 * YAML flow-seq-start error. Before this change, the parser threw and the
 * entire install aborted. With `onParseError` threaded through the install
 * path, the bad file is skipped, recorded on the report, and the remaining
 * files install cleanly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';
import type { InstallData } from '../../src/cli/command-result.js';

const ROOT = join(tmpdir(), 'am-install-broken-frontmatter');

function writeFile(path: string, content: string): void {
  writeFileSync(path, content);
}

// `argument-hint: [path/to/video.mp4] [interval] [output-dir]` mirrors the
// real qdhenry repo's failure: YAML treats the bracket pairs as a flow
// sequence and chokes on the second `[`.
const BAD_FRONTMATTER_HEAD = [
  '---',
  'description: Extract frames from a video.',
  'argument-hint: [path/to/video.mp4] [interval] [output-dir]',
  '---',
  '',
  '# extract-video-frames',
  'Body content.',
].join('\n');

const GOOD_COMMAND = (name: string): string =>
  ['---', `description: ${name} command.`, '---', '', `# ${name}`, 'Body.'].join('\n');

function seedUpstreamWithMixedCommands(upstream: string): void {
  mkdirSync(join(upstream, 'commands'), { recursive: true });
  writeFile(join(upstream, 'commands', 'good-one.md'), GOOD_COMMAND('good-one'));
  writeFile(join(upstream, 'commands', 'good-two.md'), GOOD_COMMAND('good-two'));
  writeFile(join(upstream, 'commands', 'extract-video-frames.md'), BAD_FRONTMATTER_HEAD);
}

function seedUpstreamWithAllBad(upstream: string): void {
  mkdirSync(join(upstream, 'commands'), { recursive: true });
  writeFile(join(upstream, 'commands', 'a.md'), BAD_FRONTMATTER_HEAD);
  writeFile(join(upstream, 'commands', 'b.md'), BAD_FRONTMATTER_HEAD);
}

function seedProject(project: string): void {
  mkdirSync(join(project, '.agentsmesh', 'rules'), { recursive: true });
  writeFile(
    join(project, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, commands]\nextends: []\n',
  );
  writeFile(join(project, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('install broken-frontmatter (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('skips the file with invalid frontmatter and installs the rest', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');
    seedUpstreamWithMixedCommands(upstream);
    seedProject(project);

    const result = await runInstall(
      { force: true, as: 'commands', path: 'commands', name: 'mixed-pack' },
      [upstream],
      project,
    );

    expect(result.exitCode).toBe(0);
    const data = result.data as InstallData;
    // Both good files installed; the bad one is absent.
    const installedNames = data.installed.map((i) => i.name).sort();
    expect(installedNames).toEqual(['good-one', 'good-two']);
    // brokenResources surfaces the skipped file with its YAML cause.
    expect(data.brokenResources).toBeDefined();
    expect(data.brokenResources).toHaveLength(1);
    const skipped = data.brokenResources![0]!;
    expect(skipped.kind).toBe('frontmatter');
    expect(skipped.path).toContain('extract-video-frames.md');
    expect(skipped.reason).toContain('Failed to parse frontmatter');
  });

  it('errors out with a listing of skipped files when every file is broken', async () => {
    const upstream = join(ROOT, 'upstream');
    const project = join(ROOT, 'project');
    seedUpstreamWithAllBad(upstream);
    seedProject(project);

    await expect(
      runInstall(
        { force: true, as: 'commands', path: 'commands', name: 'all-bad-pack' },
        [upstream],
        project,
      ),
    ).rejects.toThrow(/No installable resources after skipping invalid files \(2\)/);
    // Error must point the user at the source-side fix (frontmatter) and the
    // --path narrowing escape hatch so they don't get stuck.
    await expect(
      runInstall(
        { force: true, as: 'commands', path: 'commands', name: 'all-bad-pack' },
        [upstream],
        project,
      ),
    ).rejects.toThrow(/frontmatter/);
  });
});
