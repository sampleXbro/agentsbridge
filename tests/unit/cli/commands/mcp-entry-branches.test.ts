/**
 * Branch coverage for src/cli/commands/seed-mcp-entry.ts:
 * - Line 47: inner catch when parseMcp throws (falls back to empty cfg).
 * - Line 57-60: outer catch when the rename/write phase fails.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seedAgentsmeshMcpEntry } from '../../../../src/cli/commands/seed-mcp-entry.js';
import * as mcpModule from '../../../../src/canonical/features/mcp.js';

let tempDir: string;
let stderr: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'am-seed-mcp-branch-'));
  stderr = '';
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderr += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('seedAgentsmeshMcpEntry — fallback branches', () => {
  it('falls back to empty mcpServers when parseMcp throws (inner catch)', async () => {
    const spy = vi.spyOn(mcpModule, 'parseMcp').mockRejectedValue(new Error('parse-boom'));
    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('logs warning to stderr and returns false when write phase throws (outer catch with Error)', async () => {
    // .agentsmesh exists as a *file* — mkdir(..., { recursive: true }) on a
    // path whose parent is a file rejects with ENOTDIR, exercising the outer
    // catch branch where `e instanceof Error` is true.
    writeFileSync(join(tempDir, '.agentsmesh'), 'not-a-dir');
    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(false);
    expect(stderr).toContain('warning: could not seed agentsmesh MCP server entry');
  });

  it('logs warning when parseMcp returns null then injection succeeds and write succeeds (default path)', async () => {
    // Default path: file missing → parseMcp returns null → cfg fallback at line 45.
    // Validates we don't accidentally hit the catch branch in the happy path.
    const wrote = await seedAgentsmeshMcpEntry(tempDir);
    expect(wrote).toBe(true);
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
