/**
 * Unit tests for agentsmesh watch command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWatch } from '../../../../src/cli/commands/watch.js';
import * as matrixMod from '../../../../src/cli/commands/matrix.js';
import { logger } from '../../../../src/utils/logger.js';

import { randomBytes } from 'node:crypto';
const TEST_DIR = join(tmpdir(), 'am-watch-cmd-test-' + randomBytes(4).toString('hex'));

function setupProject(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
}

beforeEach(() => setupProject());
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runWatch', () => {
  it('throws when not initialized (no config)', async () => {
    rmSync(join(TEST_DIR, 'agentsmesh.yaml'));
    await expect(runWatch({}, TEST_DIR)).rejects.toThrow(/agentsmesh\.yaml/);
  });

  it('starts watching and returns stop function', async () => {
    const result = await runWatch({}, TEST_DIR);
    expect(result).toBeDefined();
    expect(typeof result?.stop).toBe('function');
    await result!.stop();
  });

  it('respects --targets flag', async () => {
    const result = await runWatch({ targets: 'claude-code' }, TEST_DIR);
    expect(result).toBeDefined();
    await result!.stop();
  });

  it('stops and clears debounce when stop called during debounce', async () => {
    const result = await runWatch({}, TEST_DIR);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      '---\ndescription: ""\n---\n# Other',
    );
    await result!.stop();
  });

  it('calls runMatrix when features change', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const result = await runWatch({}, TEST_DIR);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'new.md'),
      '---\ndescription: "New"\n---\n# New',
    );
    await vi.waitFor(() => expect(runMatrixSpy).toHaveBeenCalled(), { timeout: 3000 });
    runMatrixSpy.mockRestore();
    await result!.stop();
  });

  it('computes fingerprint with permissions', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, permissions]
`,
    );
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Read\n  - Grep\ndeny: []',
    );
    const result = await runWatch({}, TEST_DIR);
    await result!.stop();
  });

  it('calls runMatrix when features change (new rule adds to fingerprint)', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const result = await runWatch({}, TEST_DIR);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'new.md'),
      '---\ndescription: "New"\n---\n# New',
    );
    await vi.waitFor(() => expect(runMatrixSpy).toHaveBeenCalled(), { timeout: 3000 });
    runMatrixSpy.mockRestore();
    await result!.stop();
  });

  it('logs Regenerated when fingerprint unchanged (body-only edit)', async () => {
    const runMatrixSpy = vi.spyOn(matrixMod, 'runMatrix').mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const result = await runWatch({}, TEST_DIR);
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
- Added one line (same rule count)
`,
    );
    await vi.waitFor(() => expect(infoSpy).toHaveBeenCalledWith('Regenerated.'), { timeout: 3000 });
    expect(runMatrixSpy).not.toHaveBeenCalled();
    runMatrixSpy.mockRestore();
    infoSpy.mockRestore();
    await result!.stop();
  });

  it('does not retrigger from its own .agentsmesh/.lock writes while idle', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      'generated_at: "2026-03-15T14:00:00Z"\nchecksums: {}\nextends: {}\n',
    );
    const result = await runWatch({}, TEST_DIR);

    await vi.waitFor(
      () =>
        expect(
          infoSpy.mock.calls.filter(([message]) => message === 'Regenerated.').length,
        ).toBeGreaterThanOrEqual(1),
      { timeout: 3000 },
    );

    const regenCountAfterStartup = infoSpy.mock.calls.filter(
      ([message]) => message === 'Regenerated.',
    ).length;

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(infoSpy.mock.calls.filter(([message]) => message === 'Regenerated.').length).toBe(
      regenCountAfterStartup,
    );

    infoSpy.mockRestore();
    await result!.stop();
  });
});
