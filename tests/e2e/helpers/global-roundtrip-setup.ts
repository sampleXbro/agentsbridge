import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from './setup.js';

export interface TestEnv {
  homeDir: string;
  canonicalDir: string;
  projectDir: string;
}

/**
 * Creates isolated temp home + project dirs for global-mode round-trip tests.
 * Stubs HOME/USERPROFILE so all global paths resolve under homeDir.
 */
export function useGlobalEnv(): TestEnv {
  const env: TestEnv = { homeDir: '', canonicalDir: '', projectDir: '' };

  beforeEach(() => {
    const ts = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    env.homeDir = join(tmpdir(), `am-rt-${ts}`);
    env.projectDir = join(tmpdir(), `am-proj-${ts}`);
    mkdirSync(env.homeDir, { recursive: true });
    mkdirSync(env.projectDir, { recursive: true });
    env.canonicalDir = join(env.homeDir, '.agentsmesh');
    vi.stubEnv('HOME', env.homeDir);
    vi.stubEnv('USERPROFILE', env.homeDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (env.homeDir) cleanup(env.homeDir);
    if (env.projectDir) cleanup(env.projectDir);
  });

  return env;
}
