import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkflowJob {
  needs?: string | string[];
  strategy?: { matrix?: { include?: Array<Record<string, string>> } };
  steps: Array<Record<string, unknown>>;
  'runs-on'?: string;
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
}

const ROOT = process.cwd();

function readCiWorkflow(): Workflow {
  return parse(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) as Workflow;
}

describe('CI binary smoke tests', () => {
  it('cross-compiles all five Bun binaries in a dedicated build job', () => {
    // The release pipeline ships agentsmesh-linux-{x64,arm64}, -darwin-{x64,arm64},
    // and -windows-x64.exe. CI must build the same set so a broken cross-compile
    // is caught on every PR, not at release time.
    const workflow = readCiWorkflow();
    const job = workflow.jobs['build-binaries'];
    expect(job, 'expected a `build-binaries` job').toBeDefined();
    const runsOn = job!['runs-on'];
    expect(runsOn).toBe('ubuntu-latest');
    const allRun = job!.steps.map((s) => String((s as { run?: string }).run ?? '')).join('\n');
    expect(allRun).toMatch(/--target=bun-linux-x64\b/);
    expect(allRun).toMatch(/--target=bun-linux-arm64\b/);
    expect(allRun).toMatch(/--target=bun-darwin-x64\b/);
    expect(allRun).toMatch(/--target=bun-darwin-arm64\b/);
    expect(allRun).toMatch(/--target=bun-windows-x64\b/);
  });

  it('uploads the built binaries as a workflow artifact for downstream jobs', () => {
    const workflow = readCiWorkflow();
    const job = workflow.jobs['build-binaries'];
    const upload = job!.steps.find(
      (s) =>
        typeof (s as { uses?: string }).uses === 'string' &&
        (s as { uses: string }).uses.startsWith('actions/upload-artifact'),
    );
    expect(upload, 'expected an actions/upload-artifact step').toBeDefined();
  });

  it('smoke-tests each native-runner-supported binary on its target OS', () => {
    // GitHub-hosted runners cover linux-x64 (ubuntu-latest), linux-arm64
    // (ubuntu-24.04-arm), darwin-x64 (macos-latest), darwin-arm64 (macos-latest), and
    // windows-x64 (windows-latest). Every shipped binary must be smoked on
    // exactly one matching runner.
    const workflow = readCiWorkflow();
    const job = workflow.jobs['smoke-binaries'];
    expect(job, 'expected a `smoke-binaries` job').toBeDefined();
    expect(job!.needs).toContain('build-binaries');
    const matrix = job!.strategy?.matrix?.include ?? [];
    const pairs = matrix.map((m) => `${m.os}|${m.binary}`).sort();
    expect(pairs).toEqual(
      [
        'macos-latest|agentsmesh-darwin-x64',
        'macos-latest|agentsmesh-darwin-arm64',
        'ubuntu-24.04-arm|agentsmesh-linux-arm64',
        'ubuntu-latest|agentsmesh-linux-x64',
        'windows-latest|agentsmesh-windows-x64.exe',
      ].sort(),
    );
  });

  it('smoke step exercises --version, init scaffold, generate, and check', () => {
    const workflow = readCiWorkflow();
    const job = workflow.jobs['smoke-binaries'];
    const smokeStep = job!.steps.find((s) =>
      String((s as { run?: string }).run ?? '').includes('--version'),
    );
    expect(smokeStep, 'expected a step that runs the binary').toBeDefined();
    const run = String((smokeStep as { run?: string }).run ?? '');
    expect(run).toMatch(/init\s+--yes/);
    expect(run).toMatch(/\bgenerate\b/);
    expect(run).toMatch(/\bcheck\b/);
    expect(run).toContain('.agentsmesh/rules/_root.md');
  });
});
