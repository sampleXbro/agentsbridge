/**
 * Syntax errors in mcp.json / permissions.yaml / hooks.yaml must fail loudly
 * in strict mode (generate/check/lint) and only skip with a callback (install).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMcp } from '../../../src/canonical/features/mcp.js';
import { parsePermissions } from '../../../src/canonical/features/permissions.js';
import { parseHooks } from '../../../src/canonical/features/hooks.js';
import { loadCanonicalFiles } from '../../../src/canonical/load/loader.js';

let root: string;
let dir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  dir = join(root, '.agentsmesh');
  await mkdir(join(dir, 'rules'), { recursive: true });
  await writeFile(join(dir, 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n', 'utf-8');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const BROKEN_JSON = '{ "mcpServers": { "ctx7": { "command": "npx" }, } }';
const BROKEN_YAML = 'allow: ["Bash(ls:*)"]\ndeny\n  - x\n';

describe('strict mode: a syntax error is a hard error, not a missing file', () => {
  it('parseMcp rejects malformed JSON with the file path in the message', async () => {
    const path = join(dir, 'mcp.json');
    await writeFile(path, BROKEN_JSON, 'utf-8');
    await expect(parseMcp(path)).rejects.toMatchObject({
      code: 'AM_CONFIG_INVALID',
      message: expect.stringContaining('mcp.json'),
    });
  });

  it('parsePermissions rejects malformed YAML', async () => {
    const path = join(dir, 'permissions.yaml');
    await writeFile(path, BROKEN_YAML, 'utf-8');
    await expect(parsePermissions(path)).rejects.toMatchObject({ code: 'AM_CONFIG_INVALID' });
  });

  it('parseHooks rejects malformed YAML', async () => {
    const path = join(dir, 'hooks.yaml');
    await writeFile(path, 'PreToolUse:\n  - command: "x\n', 'utf-8');
    await expect(parseHooks(path)).rejects.toMatchObject({ code: 'AM_CONFIG_INVALID' });
  });

  it('a missing file is still null', async () => {
    expect(await parseMcp(join(dir, 'mcp.json'))).toBeNull();
    expect(await parsePermissions(join(dir, 'permissions.yaml'))).toBeNull();
    expect(await parseHooks(join(dir, 'hooks.yaml'))).toBeNull();
  });

  it('loadCanonicalFiles surfaces the error instead of dropping the feature', async () => {
    await writeFile(join(dir, 'mcp.json'), BROKEN_JSON, 'utf-8');
    await expect(loadCanonicalFiles(root)).rejects.toMatchObject({ code: 'AM_CONFIG_INVALID' });
  });
});

describe('lenient mode: onParseError skips the file and reports it', () => {
  it('each parser reports the path and returns null', async () => {
    await writeFile(join(dir, 'mcp.json'), BROKEN_JSON, 'utf-8');
    await writeFile(join(dir, 'permissions.yaml'), BROKEN_YAML, 'utf-8');
    await writeFile(join(dir, 'hooks.yaml'), 'PreToolUse:\n  - command: "x\n', 'utf-8');
    const seen: string[] = [];
    const onParseError = (_err: Error, filePath: string): void => {
      seen.push(filePath);
    };
    expect(await parseMcp(join(dir, 'mcp.json'), onParseError)).toBeNull();
    expect(await parsePermissions(join(dir, 'permissions.yaml'), onParseError)).toBeNull();
    expect(await parseHooks(join(dir, 'hooks.yaml'), onParseError)).toBeNull();
    expect(seen).toEqual([
      join(dir, 'mcp.json'),
      join(dir, 'permissions.yaml'),
      join(dir, 'hooks.yaml'),
    ]);
  });

  it('loadCanonicalFiles threads the callback through', async () => {
    await writeFile(join(dir, 'mcp.json'), BROKEN_JSON, 'utf-8');
    const seen: string[] = [];
    const canonical = await loadCanonicalFiles(root, {
      onParseError: (_err, filePath) => {
        seen.push(filePath);
      },
    });
    expect(canonical.mcp).toBeNull();
    expect(seen).toEqual([join(dir, 'mcp.json')]);
  });
});
