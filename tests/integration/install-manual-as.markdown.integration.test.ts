import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run-install.js';
import { listRelativeFiles, readInstallManifest } from '../helpers/install-test-helpers.js';
import {
  MARKDOWN_CASES,
  manifestFeatures,
  pickedNames,
  seedCollection,
  seedProject,
} from '../helpers/install-markdown-fixture.js';

const ROOT = join(tmpdir(), 'am-install-manual-as-markdown');

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('install manual --as markdown entities (integration)', () => {
  it.each(MARKDOWN_CASES)(
    'bulk installs $kind folders with exact generated trees',
    async (testCase) => {
      const upstream = join(ROOT, 'upstream', testCase.kind);
      const project = join(ROOT, 'project');
      seedCollection(upstream, testCase.files);
      seedProject(project, testCase.kind);

      await runInstall(
        { force: true, as: testCase.kind, path: testCase.kind, name: `bulk-${testCase.kind}` },
        [join(ROOT, 'upstream')],
        project,
      );

      expect(
        listRelativeFiles(
          join(project, '.agentsmesh', 'packs', `bulk-${testCase.kind}`, testCase.kind),
        ),
      ).toEqual(testCase.expectedPackFiles);
      expect(listRelativeFiles(join(project, '.claude'))).toEqual(testCase.expectedGeneratedFiles);
      expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml'))).toEqual({
        version: 1,
        installs: [
          {
            as: testCase.kind,
            features: manifestFeatures(testCase.kind),
            name: `bulk-${testCase.kind}`,
            path: testCase.kind,
            source: '../upstream',
            source_kind: 'local',
          },
        ],
      });
    },
  );

  it.each(MARKDOWN_CASES)(
    'single-item installs $kind via explicit path with exact picks',
    async (testCase) => {
      const upstream = join(ROOT, 'upstream', testCase.kind);
      const project = join(ROOT, 'project');
      seedCollection(upstream, testCase.files);
      seedProject(project, testCase.kind);
      const chosen =
        Object.keys(testCase.files).find((file) => !file.startsWith('_root')) ??
        Object.keys(testCase.files)[0]!;
      const expectedOutput = chosen.split('/').at(-1)!;

      await runInstall(
        {
          force: true,
          as: testCase.kind,
          path: `${testCase.kind}/${chosen}`,
          name: `single-${testCase.kind}`,
        },
        [join(ROOT, 'upstream')],
        project,
      );

      expect(
        listRelativeFiles(
          join(project, '.agentsmesh', 'packs', `single-${testCase.kind}`, testCase.kind),
        ),
      ).toEqual([expectedOutput]);
      expect(listRelativeFiles(join(project, '.claude'))).toEqual(
        testCase.kind === 'rules'
          ? ['CLAUDE.md', 'rules/quality.md']
          : ['CLAUDE.md', `${testCase.kind}/${expectedOutput}`],
      );
      expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
        {
          as: testCase.kind,
          features: manifestFeatures(testCase.kind),
          name: `single-${testCase.kind}`,
          path: testCase.kind,
          pick: { [testCase.kind]: pickedNames([expectedOutput]) },
          source: '../upstream',
          source_kind: 'local',
        },
      ]);
    },
  );

  it.each(MARKDOWN_CASES)(
    'single-item installs $kind from a direct source path',
    async (testCase) => {
      const upstream = join(ROOT, 'upstream', testCase.kind);
      const project = join(ROOT, 'project');
      seedCollection(upstream, testCase.files);
      seedProject(project, testCase.kind);
      const chosen =
        Object.keys(testCase.files).find((file) => !file.startsWith('_root')) ??
        Object.keys(testCase.files)[0]!;
      const expectedOutput = chosen.split('/').at(-1)!;

      await runInstall(
        { force: true, as: testCase.kind, name: `direct-${testCase.kind}` },
        [join(upstream, chosen)],
        project,
      );

      expect(
        listRelativeFiles(
          join(project, '.agentsmesh', 'packs', `direct-${testCase.kind}`, testCase.kind),
        ),
      ).toEqual([expectedOutput]);
      expect(listRelativeFiles(join(project, '.claude'))).toEqual(
        testCase.kind === 'rules'
          ? ['CLAUDE.md', 'rules/quality.md']
          : ['CLAUDE.md', `${testCase.kind}/${expectedOutput}`],
      );
      expect(readInstallManifest(join(project, '.agentsmesh', 'installs.yaml')).installs).toEqual([
        {
          as: testCase.kind,
          features: manifestFeatures(testCase.kind),
          name: `direct-${testCase.kind}`,
          pick: { [testCase.kind]: pickedNames([expectedOutput]) },
          source: `../upstream/${testCase.kind}/${chosen}`,
          source_kind: 'local',
        },
      ]);
    },
  );
});
