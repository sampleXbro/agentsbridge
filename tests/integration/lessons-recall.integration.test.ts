import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseIndex } from '../../src/lessons/index-schema.js';
import { matchTriggers, type ToolEvent } from '../../src/lessons/matcher.js';
import { lessonsPaths } from '../../src/lessons/paths.js';
import { readTriggeredLessons } from '../../src/lessons/store.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const idx = parseIndex(parseYaml(readFileSync(lessonsPaths(REPO).index, 'utf8')) as unknown);

/**
 * Each case mirrors a real incident from .agentsmesh/lessons/journal.md and
 * asserts that the cluster topic which would have caught it actually fires for
 * the corresponding Edit/Write/Bash/task event. ≥1 case per cluster.
 */
const CASES: ReadonlyArray<{
  name: string;
  event: ToolEvent;
  expectedTopic: string;
}> = [
  // windows-paths
  {
    name: 'editing src/utils/filesystem/windows-path-safety.ts → windows-paths',
    event: { kind: 'edit', filePath: 'src/utils/filesystem/windows-path-safety.ts' },
    expectedTopic: 'windows-paths',
  },
  {
    name: 'task description mentioning chokidar polling → windows-paths',
    event: { kind: 'task', text: 'Add chokidar polling on Windows runners' },
    expectedTopic: 'windows-paths',
  },
  // shell-quoting
  {
    name: '`rg ...` command → shell-quoting',
    event: { kind: 'bash', command: "rg 'foo' src/" },
    expectedTopic: 'shell-quoting',
  },
  {
    name: 'editing scripts/install.sh → shell-quoting',
    event: { kind: 'edit', filePath: 'scripts/install.sh' },
    expectedTopic: 'shell-quoting',
  },
  // link-rebaser
  {
    name: 'editing src/core/reference/link-rebaser.ts → link-rebaser',
    event: { kind: 'edit', filePath: 'src/core/reference/link-rebaser.ts' },
    expectedTopic: 'link-rebaser',
  },
  // install-import-pickers
  {
    name: 'editing src/install/picker/select-candidates.ts → install-import-pickers',
    event: { kind: 'edit', filePath: 'src/install/picker/select-candidates.ts' },
    expectedTopic: 'install-import-pickers',
  },
  {
    name: '`agentsmesh install` command → install-import-pickers',
    event: { kind: 'bash', command: 'node dist/cli.js install github:foo/bar' },
    expectedTopic: 'install-import-pickers',
  },
  // watch-and-test-timing
  {
    name: 'editing tests/harness/watch.ts → watch-and-test-timing',
    event: { kind: 'edit', filePath: 'tests/harness/watch.ts' },
    expectedTopic: 'watch-and-test-timing',
  },
  {
    name: 'task mentioning vi.waitFor → watch-and-test-timing',
    event: { kind: 'task', text: 'Bump vi.waitFor timeout for the watch suite' },
    expectedTopic: 'watch-and-test-timing',
  },
  // dist-backed-tests
  {
    name: '`pnpm test:e2e` command → dist-backed-tests',
    event: { kind: 'bash', command: 'pnpm test:e2e --run install.e2e' },
    expectedTopic: 'dist-backed-tests',
  },
  {
    name: 'editing tests/e2e/helpers/run-cli.ts → dist-backed-tests',
    event: { kind: 'edit', filePath: 'tests/e2e/helpers/run-cli.ts' },
    expectedTopic: 'dist-backed-tests',
  },
  // generation-collision-source-maps
  {
    name: 'editing src/core/generate/engine.ts → generation-collision-source-maps',
    event: { kind: 'edit', filePath: 'src/core/generate/engine.ts' },
    expectedTopic: 'generation-collision-source-maps',
  },
  {
    name: 'editing src/core/reference/output-source-map.ts → generation-collision-source-maps',
    event: { kind: 'edit', filePath: 'src/core/reference/output-source-map.ts' },
    expectedTopic: 'generation-collision-source-maps',
  },
  // global-mode
  {
    name: 'task mentioning --global → global-mode',
    event: { kind: 'task', text: 'Add --global support for cline' },
    expectedTopic: 'global-mode',
  },
  {
    name: '`generate --global` command → global-mode',
    event: { kind: 'bash', command: 'node dist/cli.js generate --global' },
    expectedTopic: 'global-mode',
  },
  // typescript-esm-cycles
  {
    name: 'editing src/targets/cursor/import-mappers.ts → typescript-esm-cycles',
    event: { kind: 'edit', filePath: 'src/targets/cursor/import-mappers.ts' },
    expectedTopic: 'typescript-esm-cycles',
  },
  {
    name: '`pnpm typecheck` command → typescript-esm-cycles',
    event: { kind: 'bash', command: 'pnpm typecheck' },
    expectedTopic: 'typescript-esm-cycles',
  },
  // ci-and-release-security
  {
    name: 'editing .github/workflows/publish.yml → ci-and-release-security',
    event: { kind: 'edit', filePath: '.github/workflows/publish.yml' },
    expectedTopic: 'ci-and-release-security',
  },
  {
    name: 'task mentioning trusted publish → ci-and-release-security',
    event: { kind: 'task', text: 'Investigate npm trusted publish runner mismatch' },
    expectedTopic: 'ci-and-release-security',
  },
  // frontmatter-and-canonical-shapes
  {
    name: 'task mentioning frontmatter → frontmatter-and-canonical-shapes',
    event: { kind: 'task', text: 'Switch importer to tryParseFrontmatter for lenient parsing' },
    expectedTopic: 'frontmatter-and-canonical-shapes',
  },
  // fixture-and-assertion-discipline
  {
    name: 'editing tests/fixtures/foo.json → fixture-and-assertion-discipline',
    event: { kind: 'edit', filePath: 'tests/fixtures/foo.json' },
    expectedTopic: 'fixture-and-assertion-discipline',
  },
  {
    name: 'task mentioning ValidatedConfig mock → fixture-and-assertion-discipline',
    event: { kind: 'task', text: 'Tighten mockLoadScopedConfig ValidatedConfig fixture' },
    expectedTopic: 'fixture-and-assertion-discipline',
  },
];

describe('lessons recall', () => {
  it.each(CASES)('$name', ({ event, expectedTopic }) => {
    const matched = matchTriggers(idx.clusters, event);
    const topics = matched.map((c) => c.topic);
    expect(topics, `event=${JSON.stringify(event)} matched=${topics.join(',')}`).toContain(
      expectedTopic,
    );
  });

  it.each(CASES)('loads topic content for $name', ({ event, expectedTopic }) => {
    const lessons = readTriggeredLessons(REPO, event);
    const topic = idx.clusters.find((cluster) => cluster.topic === expectedTopic);
    expect(topic).toBeDefined();
    const hit = lessons.find((lesson) => lesson.cluster.topic === expectedTopic);
    expect(hit?.relativePath).toBe(topic?.file);
    expect(hit?.content).toContain('## Rules');
  });

  it('covers every cluster at least once', () => {
    const expected = new Set(CASES.map((c) => c.expectedTopic));
    for (const cluster of idx.clusters) {
      expect(expected, `cluster ${cluster.topic} missing from recall cases`).toContain(
        cluster.topic,
      );
    }
  });
});
