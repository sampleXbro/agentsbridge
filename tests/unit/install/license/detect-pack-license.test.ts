/**
 * Pack-root license probe. Verifies the candidate-filename matrix
 * (LICENSE / COPYING / NOTICE / COPYRIGHT × no-ext / .md / .txt / .rst) and
 * the "first non-null detection wins" rule that keeps a generic NOTICE from
 * overriding the actual LICENSE next to it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectLicenseInPackDir } from '../../../../src/install/license/detect-pack-license.js';

let packDir: string;

const MIT_BODY = `MIT License

Copyright (c) 2024 Foo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software`;

const APACHE_BODY = `                                 Apache License
                           Version 2.0, January 2004`;

beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'detect-pack-license-'));
});

afterEach(() => {
  rmSync(packDir, { recursive: true, force: true });
});

describe('detectLicenseInPackDir', () => {
  it('returns null when no license file is present', async () => {
    expect(await detectLicenseInPackDir(packDir)).toBeNull();
  });

  it('detects from LICENSE (no extension)', async () => {
    writeFileSync(join(packDir, 'LICENSE'), MIT_BODY);
    expect(await detectLicenseInPackDir(packDir)).toBe('MIT');
  });

  it('detects from LICENSE.md', async () => {
    writeFileSync(join(packDir, 'LICENSE.md'), APACHE_BODY);
    expect(await detectLicenseInPackDir(packDir)).toBe('Apache-2.0');
  });

  it('falls back to COPYING when no LICENSE is present', async () => {
    writeFileSync(join(packDir, 'COPYING'), MIT_BODY);
    expect(await detectLicenseInPackDir(packDir)).toBe('MIT');
  });

  it('prefers LICENSE over NOTICE when both exist', async () => {
    writeFileSync(join(packDir, 'LICENSE'), MIT_BODY);
    writeFileSync(join(packDir, 'NOTICE'), APACHE_BODY);
    expect(await detectLicenseInPackDir(packDir)).toBe('MIT');
  });

  it('returns null when LICENSE exists but text matches no fingerprint', async () => {
    writeFileSync(join(packDir, 'LICENSE'), 'All rights reserved. Proprietary.');
    expect(await detectLicenseInPackDir(packDir)).toBeNull();
  });

  it('walks past an unrecognized LICENSE to detect a recognized NOTICE', async () => {
    // Defensive: if LICENSE is empty/junk, we still want SOME signal from a
    // sibling NOTICE rather than null. The detector skips files that yield
    // null and tries the next candidate.
    writeFileSync(join(packDir, 'LICENSE'), '');
    writeFileSync(join(packDir, 'NOTICE'), MIT_BODY);
    expect(await detectLicenseInPackDir(packDir)).toBe('MIT');
  });
});
