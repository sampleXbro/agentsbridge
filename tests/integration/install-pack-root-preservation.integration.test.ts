import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';

/**
 * Pack-root README/LICENSE preservation (Tiny A).
 *
 * Upstream repos commonly ship `README.md` + `LICENSE` at their root. When
 * agentsmesh installs from such a source, those files must travel into the
 * materialized pack root (`.agentsmesh/packs/<name>/`) so:
 *   - legal attribution survives redistribution (LICENSE);
 *   - the consumer has a visible link to upstream context (README).
 *
 * Files inside `agents/`, `commands/`, `rules/` are still filtered from
 * canonical entity discovery — they don't become phantom rules/commands/agents.
 * Only top-level boilerplate is copied verbatim.
 */
const ROOT = join(tmpdir(), 'am-install-pack-root-preservation');

describe('install pack root preservation (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(ROOT, 'project', '.agentsmesh'), { recursive: true });

    // Upstream: rules + top-level README/LICENSE.
    writeFileSync(
      join(ROOT, 'upstream', '.agentsmesh', 'rules', 'sample.md'),
      '---\nroot: false\ndescription: sample rule\n---\n# Sample\n',
    );
    writeFileSync(join(ROOT, 'upstream', 'README.md'), '# Upstream readme\n', 'utf-8');
    writeFileSync(join(ROOT, 'upstream', 'LICENSE'), 'MIT License\nCopyright …\n', 'utf-8');
    // Noise should NOT be copied.
    writeFileSync(join(ROOT, 'upstream', 'CHANGELOG.md'), '# changelog\n', 'utf-8');
    writeFileSync(join(ROOT, 'upstream', 'CONTRIBUTING.md'), 'contribute\n', 'utf-8');

    writeFileSync(
      join(ROOT, 'project', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('copies upstream README/LICENSE into the pack root and excludes noise', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'preserved-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'preserved-pack');
    expect(existsSync(join(packDir, 'README.md'))).toBe(true);
    expect(existsSync(join(packDir, 'LICENSE'))).toBe(true);
    expect(readFileSync(join(packDir, 'README.md'), 'utf-8')).toBe('# Upstream readme\n');
    expect(readFileSync(join(packDir, 'LICENSE'), 'utf-8')).toBe('MIT License\nCopyright …\n');

    // Noise boilerplate is filtered out.
    expect(existsSync(join(packDir, 'CHANGELOG.md'))).toBe(false);
    expect(existsSync(join(packDir, 'CONTRIBUTING.md'))).toBe(false);

    // Canonical pack content is still present.
    expect(existsSync(join(packDir, 'rules', 'sample.md'))).toBe(true);
  });

  it('refreshes README/LICENSE on re-install (upstream is source of truth)', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'preserved-pack' }, [upstream], project);

    // Upstream README changes — re-install must mirror it.
    writeFileSync(join(upstream, 'README.md'), '# Upstream readme v2\n', 'utf-8');

    await runInstall({ force: true, name: 'preserved-pack' }, [upstream], project);

    const packDir = join(project, '.agentsmesh', 'packs', 'preserved-pack');
    expect(readFileSync(join(packDir, 'README.md'), 'utf-8')).toBe('# Upstream readme v2\n');
  });
});
