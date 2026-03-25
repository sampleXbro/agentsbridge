import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { fileContains, fileExists, readJson } from './helpers/assertions.js';

describe('generate settings merge', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('merges Claude settings with existing unrelated keys', async () => {
    dir = createTestProject('canonical-full');
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ theme: 'keep-me' }, null, 2),
    );

    const result = await runCli('generate --targets claude-code', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const settings = readJson(join(dir, '.claude', 'settings.json'));
    expect(settings['theme']).toBe('keep-me');
    expect(settings['permissions']).toBeTruthy();
    expect(settings['hooks']).toBeTruthy();
    fileContains(join(dir, '.mcp.json'), '@upstash/context7-mcp');
  });

  it('merges Cursor settings with existing unrelated keys', async () => {
    dir = createTestProject('canonical-full');
    mkdirSync(join(dir, '.cursor'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'settings.json'),
      JSON.stringify({ theme: 'keep-me' }, null, 2),
    );

    const result = await runCli('generate --targets cursor', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    // Cursor has no native tool-permission file — settings.json is not touched
    const settings = readJson(join(dir, '.cursor', 'settings.json'));
    expect(settings['theme']).toBe('keep-me');
    expect(settings['permissions']).toBeUndefined();
    fileContains(join(dir, '.cursor', 'mcp.json'), '@upstash/context7-mcp');
    const hooks = readJson(join(dir, '.cursor', 'hooks.json'));
    expect(hooks['hooks']).toBeTruthy();
  });

  it('merges Gemini settings with existing unrelated keys', async () => {
    dir = createTestProject('canonical-full');
    mkdirSync(join(dir, '.gemini'), { recursive: true });
    writeFileSync(
      join(dir, '.gemini', 'settings.json'),
      JSON.stringify({ theme: 'keep-me', telemetry: false }, null, 2),
    );

    const result = await runCli('generate --targets gemini-cli', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const settings = readJson(join(dir, '.gemini', 'settings.json'));
    expect(settings['theme']).toBe('keep-me');
    expect(settings['telemetry']).toBe(false);
    expect(settings['mcpServers']).toBeTruthy();
    expect(settings['hooks']).toBeTruthy();
    fileExists(join(dir, '.geminiignore'));
    fileContains(join(dir, '.geminiignore'), 'node_modules');
  });
});
