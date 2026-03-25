import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectNativeFormat,
  KNOWN_NATIVE_PATHS,
} from '../../../src/config/native-format-detector.js';

const TEST_DIR = join(tmpdir(), 'ab-native-detect-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function mkdir(rel: string): void {
  mkdirSync(join(TEST_DIR, rel), { recursive: true });
}
function touch(rel: string): void {
  const parts = rel.split('/').slice(0, -1).join('/');
  if (parts) mkdirSync(join(TEST_DIR, parts), { recursive: true });
  writeFileSync(join(TEST_DIR, rel), '');
}

describe('detectNativeFormat', () => {
  it('returns null for an empty directory', async () => {
    expect(await detectNativeFormat(TEST_DIR)).toBeNull();
  });

  it('detects claude-code from CLAUDE.md', async () => {
    touch('CLAUDE.md');
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  it('detects claude-code from .claude/rules directory', async () => {
    mkdir('.claude/rules');
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  it('detects cursor from .cursorrules file', async () => {
    touch('.cursorrules');
    expect(await detectNativeFormat(TEST_DIR)).toBe('cursor');
  });

  it('detects copilot from .github/copilot-instructions.md', async () => {
    touch('.github/copilot-instructions.md');
    expect(await detectNativeFormat(TEST_DIR)).toBe('copilot');
  });

  it('detects gemini-cli from GEMINI.md', async () => {
    touch('GEMINI.md');
    expect(await detectNativeFormat(TEST_DIR)).toBe('gemini-cli');
  });

  it('detects codex-cli from .codex directory', async () => {
    mkdir('.codex');
    expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
  });

  it('detects codex-cli from codex.md file', async () => {
    touch('codex.md');
    expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
  });

  it('detects windsurf from .windsurfrules', async () => {
    touch('.windsurfrules');
    expect(await detectNativeFormat(TEST_DIR)).toBe('windsurf');
  });

  it('detects cline from .cline directory', async () => {
    mkdir('.cline');
    expect(await detectNativeFormat(TEST_DIR)).toBe('cline');
  });

  it('detects continue from .continue directory', async () => {
    mkdir('.continue');
    expect(await detectNativeFormat(TEST_DIR)).toBe('continue');
  });

  it('detects junie from .junie directory', async () => {
    mkdir('.junie');
    expect(await detectNativeFormat(TEST_DIR)).toBe('junie');
  });

  it('picks highest-scoring target when multiple present', async () => {
    // claude-code has 3 matches; cursor has 1
    touch('CLAUDE.md');
    mkdir('.claude/rules');
    mkdir('.claude/commands');
    touch('.cursorrules');
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  it('breaks ties by signature order (claude-code listed before cursor)', async () => {
    // Both score 1 — claude-code wins because it appears first
    touch('CLAUDE.md');
    touch('.cursorrules');
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  it('assigns AGENTS.md to codex-cli (listed before windsurf which has no AGENTS.md in signatures)', async () => {
    touch('AGENTS.md');
    expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
  });

  it('prefers codex-cli when .codex and AGENTS.md exist vs windsurf .windsurfrules alone', async () => {
    touch('AGENTS.md');
    mkdir('.codex');
    touch('.windsurfrules');
    // codex-cli: 2 (.codex + AGENTS.md), windsurf: 1 (.windsurfrules)
    expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
  });

  it('KNOWN_NATIVE_PATHS contains one representative path per supported target', () => {
    // 9 targets → 9 representative paths
    expect(KNOWN_NATIVE_PATHS).toHaveLength(9);
    expect(KNOWN_NATIVE_PATHS[0]).toBe('CLAUDE.md');
    expect(KNOWN_NATIVE_PATHS[1]).toBe('.cursorrules');
    expect(KNOWN_NATIVE_PATHS[2]).toBe('.github/copilot-instructions.md');
    expect(KNOWN_NATIVE_PATHS[3]).toBe('GEMINI.md');
    expect(KNOWN_NATIVE_PATHS[4]).toBe('.codex');
    expect(KNOWN_NATIVE_PATHS[5]).toBe('.windsurfrules');
    expect(KNOWN_NATIVE_PATHS[6]).toBe('.clinerules');
    expect(KNOWN_NATIVE_PATHS[7]).toBe('.continue');
    expect(KNOWN_NATIVE_PATHS[8]).toBe('.junie');
  });
});
