import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  os?: string[];
}

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

describe('Windows package support metadata', () => {
  it('does not restrict npm installs to POSIX operating systems', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as PackageJson;

    expect(pkg.os).toBeUndefined();
  });

  it('runs the quality matrix on Windows with Node 22', () => {
    const workflow = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');

    expect(workflow).toContain(`- os: windows-latest
            node-version: 22`);
  });
});
