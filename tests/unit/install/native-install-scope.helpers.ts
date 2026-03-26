import { afterEach, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageNativeInstallScope } from '../../../src/install/native-install-scope.js';

interface ScopeCase {
  name: string;
  target: string;
  path: string;
  files: Record<string, string>;
  features: string[];
  pick?: Record<string, string[]>;
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function normalizePick(
  pick: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!pick) return undefined;
  return Object.fromEntries(Object.entries(pick).map(([key, values]) => [key, [...values].sort()]));
}

function makeRoot(name: string): string {
  const root = join(tmpdir(), `am-native-install-scope-${name}-${Date.now()}-${roots.length}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
}

function write(root: string, relPath: string, content: string): void {
  const absPath = join(root, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);
}

export async function expectScope(testCase: ScopeCase): Promise<void> {
  const root = makeRoot(testCase.name);
  for (const [relPath, content] of Object.entries(testCase.files)) {
    write(root, relPath, content);
  }

  const scope = await stageNativeInstallScope(root, testCase.path, testCase.target);
  try {
    expect(scope.features.sort()).toEqual([...testCase.features].sort());
    expect(normalizePick(scope.pick as Record<string, string[]> | undefined)).toEqual(
      normalizePick(testCase.pick),
    );
  } finally {
    await scope.cleanup();
  }
}
