import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type PackageJson = {
  repository: { url: string };
  publishConfig?: { access?: string; provenance?: boolean };
  scripts: Record<string, string>;
};

interface WorkflowJob {
  permissions?: Record<string, string>;
  steps: Array<Record<string, unknown>>;
  needs?: string | string[];
  if?: string;
}

interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, WorkflowJob>;
}

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

  it('keeps the publish job on the supported trusted-publishing path', () => {
    const workflow = readPublishWorkflow();

    expect(workflow.jobs.publish.permissions).toMatchObject({
      contents: 'write',
      'pull-requests': 'write',
      'id-token': 'write',
    });

    expect(workflow.jobs.publish.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uses: 'actions/setup-node@v4',
          with: expect.objectContaining({
            'node-version': 24,
            'registry-url': 'https://registry.npmjs.org',
          }),
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

  it('has release-assets job that depends on publish', () => {
    const workflow = readPublishWorkflow();

    expect(workflow.jobs['release-assets']).toBeDefined();
    expect(workflow.jobs['release-assets'].needs).toBe('publish');
  });

  it('has update-tap job that depends on release-assets', () => {
    const workflow = readPublishWorkflow();

    expect(workflow.jobs['update-tap']).toBeDefined();
    expect(workflow.jobs['update-tap'].needs).toEqual(['publish', 'release-assets']);
  });

  it('supports manual re-trigger via workflow_dispatch', () => {
    const workflow = readPublishWorkflow();

    expect(workflow.on.workflow_dispatch).toBeDefined();
  });

  it('release-assets overrides default needs cascade-skip so workflow_dispatch can run when publish is skipped', () => {
    // GitHub Actions skips a job if any `needs:` job is skipped or failed UNLESS
    // the dependent job uses an explicit status check like `!cancelled()` or
    // `always()`. Without that, the workflow_dispatch escape hatch is broken.
    const workflow = readPublishWorkflow();
    const ifClause = workflow.jobs['release-assets'].if ?? '';
    expect(ifClause).toMatch(/!cancelled\(\)|always\(\)/);
    expect(ifClause).toContain("github.event_name == 'workflow_dispatch'");
    expect(ifClause).toMatch(/needs\.publish\.result\s*==\s*'success'/);
  });

  it('update-tap overrides default needs cascade-skip and gates on release-assets success', () => {
    const workflow = readPublishWorkflow();
    const ifClause = workflow.jobs['update-tap'].if ?? '';
    expect(ifClause).toMatch(/!cancelled\(\)|always\(\)/);
    expect(ifClause).toContain("github.event_name == 'workflow_dispatch'");
    expect(ifClause).toMatch(/needs\['release-assets'\]\.result\s*==\s*'success'/);
  });

  it('does not interpolate ${{ inputs.tag }} directly into any run: shell body (CWE-78)', () => {
    // GitHub Actions templating expands ${{ ... }} into raw script text BEFORE the shell
    // process starts, so any user-supplied input must flow through env: passthrough — never
    // appear inline in a `run:` body. workflow_dispatch input.tag is collaborator-controlled.
    const raw = readFileSync(join(ROOT, '.github', 'workflows', 'publish.yml'), 'utf8');
    const lines = raw.split('\n');
    let inRunBlock = false;
    let runIndent = 0;
    for (const line of lines) {
      const runMatch = line.match(/^(\s*)run:\s*\|/);
      if (runMatch) {
        inRunBlock = true;
        runIndent = runMatch[1].length;
        continue;
      }
      if (inRunBlock) {
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (line.trim() !== '' && indent <= runIndent) {
          inRunBlock = false;
        } else if (line.includes('${{ inputs.')) {
          throw new Error(
            `inputs.* expression interpolated directly into a run: body — use env: passthrough instead. Offending line: ${line.trim()}`,
          );
        }
      }
    }
  });

  it('does not embed HOMEBREW_TAP_TOKEN in a git remote URL (token leakage to .git/config)', () => {
    const raw = readFileSync(join(ROOT, '.github', 'workflows', 'publish.yml'), 'utf8');
    expect(raw).not.toMatch(/x-access-token:\$\{?\s*TAP_TOKEN/);
    expect(raw).not.toMatch(/x-access-token:\$\{\{\s*secrets\./);
  });

  it('declares per-job permissions on update-tap so it does not inherit publish-job grants', () => {
    const workflow = readPublishWorkflow();
    expect(workflow.jobs['update-tap'].permissions).toBeDefined();
    expect(workflow.jobs['update-tap'].permissions).toMatchObject({ contents: 'read' });
  });

  it('pins setup-bun to a concrete version (not "latest") so binary builds are reproducible', () => {
    const workflow = readPublishWorkflow();
    const setupBunStep = workflow.jobs['release-assets'].steps.find(
      (s) => typeof s.uses === 'string' && (s.uses as string).startsWith('oven-sh/setup-bun'),
    );
    expect(setupBunStep, 'expected an oven-sh/setup-bun step').toBeDefined();
    const version = (setupBunStep!.with as { 'bun-version'?: unknown } | undefined)?.[
      'bun-version'
    ];
    expect(version, 'bun-version must be specified').toBeDefined();
    expect(String(version)).not.toBe('latest');
    expect(String(version)).toMatch(/^\d+(\.\d+)*$/);
  });
});
