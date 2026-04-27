import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveNodeBin } from '../../helpers/node-bin.js';

describe('resolveNodeBin', () => {
  it('uses .cmd shims for Windows executables', () => {
    expect(resolveNodeBin('/repo', 'tsx', 'win32')).toBe(
      join('/repo', 'node_modules', '.bin', 'tsx.cmd'),
    );
  });

  it('uses extensionless shims for POSIX executables', () => {
    expect(resolveNodeBin('/repo', 'tsx', 'linux')).toBe(
      join('/repo', 'node_modules', '.bin', 'tsx'),
    );
    expect(resolveNodeBin('/repo', 'tsx', 'darwin')).toBe(
      join('/repo', 'node_modules', '.bin', 'tsx'),
    );
  });
});
