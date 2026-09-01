/**
 * generate -> write -> import round trip for Trae permissions.
 *
 * Trae collapses `Read(p)` and `Edit(p)` on the same path into one `readWrite`
 * entry, so import must not read that collapse back as "the canonical
 * `Read(p)` was removed".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Permissions } from '../../../../src/core/types.js';
import { serializeTraePermissions } from '../../../../src/targets/trae/permissions-file.js';
import { importTraeGlobalPermissions } from '../../../../src/targets/trae/global-permissions.js';
import { TRAE_GLOBAL_PERMISSIONS_FILE } from '../../../../src/targets/trae/constants.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trae-perm-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  mkdirSync(join(dir, '.trae/permission'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('trae permissions round trip', () => {
  it('keeps a canonical Read(path) that Trae folded into readWrite', async () => {
    const permissions: Permissions = {
      allow: ['Read(./src)', 'Edit(./src)', 'Read(./docs)'],
      deny: [],
    };
    writeFileSync(
      join(dir, '.agentsmesh/permissions.yaml'),
      "allow: ['Read(./src)', 'Edit(./src)', 'Read(./docs)']\ndeny: []\n",
    );
    writeFileSync(
      join(dir, TRAE_GLOBAL_PERMISSIONS_FILE),
      serializeTraePermissions(permissions, null)!,
    );

    await importTraeGlobalPermissions(dir, []);

    const canonical = parseYaml(
      readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8'),
    ) as Permissions;
    expect(new Set(canonical.allow)).toEqual(
      new Set(['Read(./src)', 'Edit(./src)', 'Read(./docs)']),
    );
  });
});
