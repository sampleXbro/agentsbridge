import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferImplicitPickFromNativePath } from '../../../../src/install/native/native-path-pick-infer.js';
import { descriptor } from '../../../../src/targets/continue/index.js';
import { CONTINUE_AGENTS_DIR } from '../../../../src/targets/continue/constants.js';

const TEST_DIR = join(tmpdir(), 'am-continue-native-install');

beforeEach(() => mkdirSync(join(TEST_DIR, CONTINUE_AGENTS_DIR), { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('continue nativeInstall — agents', () => {
  it('picks every markdown agent file the importer would read', async () => {
    writeFileSync(join(TEST_DIR, CONTINUE_AGENTS_DIR, 'reviewer.md'), '---\nname: reviewer\n---\n');
    writeFileSync(join(TEST_DIR, CONTINUE_AGENTS_DIR, 'planner.md'), '---\nname: planner\n---\n');

    expect(
      await inferImplicitPickFromNativePath(TEST_DIR, CONTINUE_AGENTS_DIR, 'continue'),
    ).toEqual({ agents: ['planner', 'reviewer'] });
  });

  it('picks nothing from a repo whose agents dir holds only assistant profiles', async () => {
    writeFileSync(join(TEST_DIR, CONTINUE_AGENTS_DIR, 'my-assistant.yaml'), 'name: my-assistant\n');

    expect(
      await inferImplicitPickFromNativePath(TEST_DIR, CONTINUE_AGENTS_DIR, 'continue'),
    ).toEqual({});
  });

  it('uses the same extension set as the agents importer', () => {
    const rule = descriptor.nativeInstall.pickPaths.find((p) => p.feature === 'agents')!;
    expect(rule.strategy).toEqual({ kind: 'basename', suffix: '.md' });
    expect(descriptor.importer.agents.extensions).toEqual(['.md']);
  });
});
