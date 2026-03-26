import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type PackageJson = {
  repository: { url: string };
  publishConfig?: { access?: string; provenance?: boolean };
  scripts: Record<string, string>;
};

type Workflow = {
  jobs: {
    release: {
      permissions: Record<string, string>;
      steps: Array<Record<string, unknown>>;
    };
  };
};

const ROOT = process.cwd();

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as PackageJson;
}

function readPublishWorkflow(): Workflow {
  return parse(readFileSync(join(ROOT, '.github', 'workflows', 'publish.yml'), 'utf8')) as Workflow;
}

describe('trusted publishing release config', () => {
  it('uses the changesets publish contract in package metadata', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts.release).toBe('pnpm build && changeset publish');
    expect(pkg.publishConfig).toEqual({
      access: 'public',
      provenance: true,
    });
    expect(pkg.repository.url).toBe('git+https://github.com/sampleXbro/agentsmesh.git');
  });

  it('keeps the publish workflow on the supported trusted-publishing path', () => {
    const workflow = readPublishWorkflow();

    expect(workflow.jobs.release.permissions).toMatchObject({
      contents: 'write',
      'pull-requests': 'write',
      'id-token': 'write',
    });

    expect(workflow.jobs.release.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uses: 'actions/setup-node@v4',
          with: expect.objectContaining({
            'registry-url': 'https://registry.npmjs.org',
          }),
        }),
        expect.objectContaining({
          name: 'Upgrade npm for trusted publishing',
          run: 'npm install -g npm@latest',
        }),
        expect.objectContaining({
          name: 'Create release PR or publish',
          uses: 'changesets/action@v1',
          with: expect.objectContaining({
            publish: 'pnpm release',
          }),
        }),
      ]),
    );
  });
});
