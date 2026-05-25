/**
 * Security: plugin source must be confined to projectRoot or node_modules.
 *
 * `agentsmesh.yaml` is a trust boundary — any actor who can write it
 * (a malicious PR contributor, a compromised CI step, a hostile template)
 * would otherwise achieve arbitrary code execution via a `plugins[].source`
 * that escapes projectRoot.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { loadPlugin } from '../../../src/plugins/load-plugin.js';
import { resetRegistry } from '../../../src/targets/catalog/registry.js';

const FIXTURE_PLUGIN_DIR = join(process.cwd(), 'tests/fixtures/plugins/simple-plugin');

beforeEach(() => {
  resetRegistry();
});

describe('loadPlugin — source containment', () => {
  it('rejects a relative source that escapes projectRoot', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'am-plugin-proj-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'am-plugin-outside-'));
    writeFileSync(join(outsideDir, 'evil.js'), 'export const descriptor = {};');
    try {
      // Build a relative path that traverses out of projectRoot.
      const relativeEscape = `../${outsideDir.split('/').pop()}/evil.js`;
      await expect(loadPlugin({ id: 'pwn', source: relativeEscape }, projectRoot)).rejects.toThrow(
        /outside.*project root|escapes/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('rejects an absolute source outside projectRoot', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'am-plugin-proj-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'am-plugin-outside-'));
    const evil = join(outsideDir, 'evil.js');
    writeFileSync(evil, 'export const descriptor = {};');
    try {
      await expect(loadPlugin({ id: 'pwn', source: evil }, projectRoot)).rejects.toThrow(
        /outside.*project root|escapes/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('rejects a file: URL pointing outside projectRoot', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'am-plugin-proj-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'am-plugin-outside-'));
    const evil = join(outsideDir, 'evil.js');
    writeFileSync(evil, 'export const descriptor = {};');
    try {
      const fileUrl = `file://${evil}`;
      await expect(loadPlugin({ id: 'pwn', source: fileUrl }, projectRoot)).rejects.toThrow(
        /outside.*project root|escapes/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('accepts a local source inside projectRoot', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'am-plugin-proj-'));
    cpSync(FIXTURE_PLUGIN_DIR, join(projectRoot, 'plugin'), { recursive: true });
    try {
      const result = await loadPlugin(
        { id: 'simple-plugin', source: './plugin/index.js' },
        projectRoot,
      );
      expect(result.descriptors).toHaveLength(1);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  if (platform() === 'win32') {
    it('rejects a Windows absolute source outside projectRoot', async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), 'am-plugin-proj-'));
      try {
        await expect(
          loadPlugin({ id: 'pwn', source: 'C:\\Windows\\System32\\evil.js' }, projectRoot),
        ).rejects.toThrow(/outside.*project root|escapes/i);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  }
});
