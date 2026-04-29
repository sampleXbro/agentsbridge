/**
 * Branch coverage tests for copilot/hook-assets.ts.
 * Targets:
 *   - SCRIPT_PREFIX_RE non-match: rewriteWrapperCommand returns original command verbatim.
 *   - buildAssetOutput: no match (no path group) returns null.
 *   - buildAssetOutput: file readable but path == empty repo-relative.
 *   - canonical.hooks=undefined returns existing outputs unchanged.
 *   - non-array entries skipped.
 *   - prefix/suffix groups missing → fallback empty strings.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addHookScriptAssets } from '../../../../src/targets/copilot/hook-assets.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function makeCanonical(hooks: CanonicalFiles['hooks']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks,
    ignore: [],
  };
}

describe('addHookScriptAssets — branch coverage', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('returns existing outputs unchanged when canonical.hooks is undefined', async () => {
    const inputs = [{ path: 'x', content: 'y' }];
    const canonical = makeCanonical(null);
    // Manually clear hooks to undefined to exercise that branch separately from null
    (canonical as { hooks: unknown }).hooks = undefined;
    const out = await addHookScriptAssets(projectRoot, canonical, inputs);
    expect(out).toEqual(inputs);
  });

  it('skips events whose entries value is not an array', async () => {
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        // not an array
        Bogus: 'nope' as unknown as never,
      }),
      [],
    );
    expect(out).toEqual([]);
  });

  it('skips entries that fail hasHookCommand (no command field)', async () => {
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: '', type: 'command' }],
      }),
      [],
    );
    expect(out).toEqual([]);
  });

  it('keeps the wrapper command verbatim when SCRIPT_PREFIX_RE does not match (no slash path)', async () => {
    // The regex requires a path that contains `/`; a bare command like `lint` does not match.
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        PreToolUse: [{ matcher: '*', command: 'lint', type: 'command' }],
      }),
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('# agentsmesh-command: lint');
    expect(out[0]!.content).toContain('\nlint\n');
  });

  it('does not copy the asset when the referenced source file does not exist', async () => {
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        PreToolUse: [{ matcher: '*', command: 'bash scripts/missing.sh --x', type: 'command' }],
      }),
      [],
    );
    // No asset copy → only the wrapper output, command stays verbatim.
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('# agentsmesh-command: bash scripts/missing.sh --x');
    expect(out[0]!.content).not.toContain('"$HOOK_DIR/scripts/missing.sh"');
  });

  it('handles relative-path command with no suffix tokens (suffix group missing)', async () => {
    mkdirSync(join(projectRoot, 'bin'), { recursive: true });
    writeFileSync(join(projectRoot, 'bin', 'do.sh'), '#!/bin/sh\necho hi\n');
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: 'bin/do.sh', type: 'command' }],
      }),
      [],
    );
    // Wrapper rewritten to use HOOK_DIR; suffix is empty since there is no trailing arg.
    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '.github/hooks/scripts/notification-0.sh',
          content: expect.stringContaining('# agentsmesh-command: "$HOOK_DIR/bin/do.sh"'),
        }),
        expect.objectContaining({
          path: '.github/hooks/scripts/bin/do.sh',
          content: expect.stringContaining('echo hi'),
        }),
      ]),
    );
  });

  it('handles ./-prefixed paths and copies the asset', async () => {
    mkdirSync(join(projectRoot, 'tools'), { recursive: true });
    writeFileSync(join(projectRoot, 'tools', 'run.sh'), '#!/bin/sh\necho run\n');
    const out = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: './tools/run.sh --foo', type: 'command' }],
      }),
      [],
    );
    expect(out.find((o) => o.path === '.github/hooks/scripts/tools/run.sh')).toBeDefined();
    const wrapper = out.find((o) => o.path === '.github/hooks/scripts/notification-0.sh');
    expect(wrapper).toBeDefined();
    expect(wrapper!.content).toContain('"$HOOK_DIR/tools/run.sh" --foo');
  });

  it('does not copy the referenced asset when it exists but resolves outside the repo (../)', async () => {
    // Create a sibling directory next to projectRoot containing an actual file.
    const sibling = mkdtempSync(join(tmpdir(), 'amesh-cov-sibling-'));
    try {
      writeFileSync(join(sibling, 'outside.sh'), '#!/bin/sh\necho out\n');
      const relativeFromProject = join('..', sibling.split('/').pop() ?? '', 'outside.sh');
      const out = await addHookScriptAssets(
        projectRoot,
        makeCanonical({
          Notification: [
            { matcher: '*', command: `bash ${relativeFromProject} --x`, type: 'command' },
          ],
        }),
        [],
      );
      // Should produce only the wrapper, no asset copy.
      expect(out).toHaveLength(1);
      expect(out[0]!.path).toBe('.github/hooks/scripts/notification-0.sh');
      expect(out[0]!.content).not.toContain('"$HOOK_DIR/');
    } finally {
      rmSync(sibling, { recursive: true, force: true });
    }
  });
});
