import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parsePermissions } from '../../../src/canonical/permissions.js';

const TEST_DIR = join(tmpdir(), 'agentsbridge-permissions-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('parsePermissions', () => {
  it('parses allow and deny arrays', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(
      path,
      `
allow:
  - Read
  - Grep
  - Write
deny:
  - Bash
`,
    );
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: ['Read', 'Grep', 'Write'],
      deny: ['Bash'],
    });
  });

  it('parses allow only when deny omitted', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(
      path,
      `
allow:
  - Read
`,
    );
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: ['Read'],
      deny: [],
    });
  });

  it('parses deny only when allow omitted', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(
      path,
      `
deny:
  - Bash
`,
    );
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: [],
      deny: ['Bash'],
    });
  });

  it('returns empty arrays for empty file', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(path, '');
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: [],
      deny: [],
    });
  });

  it('returns null for non-existent file', async () => {
    const result = await parsePermissions(join(TEST_DIR, 'nope.yaml'));
    expect(result).toBeNull();
  });

  it('returns null for malformed YAML', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(path, 'allow: [broken: yaml');
    const result = await parsePermissions(path);
    expect(result).toBeNull();
  });

  it('filters non-string entries in allow/deny', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(
      path,
      `
allow:
  - Read
  - 42
  - null
  - Grep
deny:
  - Bash
  - {}
`,
    );
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: ['Read', 'Grep'],
      deny: ['Bash'],
    });
  });

  it('treats allow/deny as arrays when they are objects', async () => {
    const path = join(TEST_DIR, 'permissions.yaml');
    writeFileSync(path, 'allow: Read\ndeny: Bash');
    const result = await parsePermissions(path);
    expect(result).toEqual({
      allow: [],
      deny: [],
    });
  });
});
