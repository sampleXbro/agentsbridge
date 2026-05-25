import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectNativeFormat,
  KNOWN_NATIVE_PATHS,
} from '../../../src/config/resolve/native-format-detector.js';
import { BUILTIN_TARGETS } from '../../../src/targets/catalog/builtin-targets.js';

const TEST_DIR = join(tmpdir(), 'am-native-detect-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

/**
 * Materialize a relative path under TEST_DIR. We always `touch` (create as a
 * file with empty content); `detectNativeFormat` checks `exists()`, which is
 * agnostic to file vs directory.
 */
function touch(rel: string): void {
  const abs = join(TEST_DIR, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, '');
}

function mkdir(rel: string): void {
  mkdirSync(join(TEST_DIR, rel), { recursive: true });
}

/** Path → list of target ids that claim it in `detectionPaths`. */
const PATH_OWNERS = ((): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const d of BUILTIN_TARGETS) {
    for (const p of d.detectionPaths) {
      const owners = map.get(p) ?? [];
      owners.push(d.id);
      map.set(p, owners);
    }
  }
  return map;
})();

function uniquePathsFor(id: string): string[] {
  const d = BUILTIN_TARGETS.find((t) => t.id === id);
  if (!d) throw new Error(`unknown target ${id}`);
  return d.detectionPaths.filter((p) => (PATH_OWNERS.get(p)?.length ?? 0) === 1);
}

describe('detectNativeFormat — descriptor-driven', () => {
  it('returns null for an empty directory', async () => {
    expect(await detectNativeFormat(TEST_DIR)).toBeNull();
  });

  describe('every descriptor with at least one unique detectionPath is detectable from that path', () => {
    for (const descriptor of BUILTIN_TARGETS) {
      const unique = uniquePathsFor(descriptor.id);
      if (unique.length === 0) continue; // documented separately for jules
      it(`detects ${descriptor.id} from unique marker "${unique[0]}"`, async () => {
        touch(unique[0]!);
        expect(await detectNativeFormat(TEST_DIR)).toBe(descriptor.id);
      });
    }
  });

  it('jules has no unique detectionPath and is intentionally undetectable from path signatures', async () => {
    expect(uniquePathsFor('jules')).toEqual([]);
    // A repo that lists only `AGENTS.md` (jules' single marker, shared by 7 targets)
    // must NOT resolve to jules — that would be a false-positive on six other tools.
    touch('AGENTS.md');
    expect(await detectNativeFormat(TEST_DIR)).not.toBe('jules');
  });

  it('returns null when only ambiguous (shared) markers are present', async () => {
    touch('AGENTS.md');
    expect(await detectNativeFormat(TEST_DIR)).toBeNull();
  });

  it('a unique marker dominates a co-present shared marker', async () => {
    touch('AGENTS.md'); // shared by 7 targets, weight ~0.143 each
    touch('.cursor/mcp.json'); // unique to cursor, weight 1.0
    expect(await detectNativeFormat(TEST_DIR)).toBe('cursor');
  });

  it('a target with more unique markers wins over a target with one', async () => {
    // claude-code: CLAUDE.md, .claude/rules, .claude/commands — all unique
    touch('CLAUDE.md');
    mkdir('.claude/rules');
    mkdir('.claude/commands');
    touch('.cursorrules'); // not in any detectionPaths (cursor uses .cursor/rules + .cursor/mcp.json)
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  it('ties between equal unique counts break alphabetically by target id', async () => {
    // claude-code: 1 unique present (CLAUDE.md). cursor: 1 unique present (.cursor/mcp.json).
    // Tie on unique count + shared score → alphabetic id → claude-code.
    touch('CLAUDE.md');
    touch('.cursor/mcp.json');
    expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
  });

  // --- Backward-compat: the 11 originally auto-detected targets keep working
  // on the same fixtures as before. New behavior is additive, not regressive.

  describe('originally-auto-detected targets remain detectable', () => {
    it('claude-code from CLAUDE.md', async () => {
      touch('CLAUDE.md');
      expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
    });
    it('claude-code from .claude/rules', async () => {
      mkdir('.claude/rules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('claude-code');
    });
    it('cursor from .cursor/rules', async () => {
      mkdir('.cursor/rules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('cursor');
    });
    it('copilot from .github/copilot-instructions.md', async () => {
      touch('.github/copilot-instructions.md');
      expect(await detectNativeFormat(TEST_DIR)).toBe('copilot');
    });
    it('gemini-cli from GEMINI.md', async () => {
      touch('GEMINI.md');
      expect(await detectNativeFormat(TEST_DIR)).toBe('gemini-cli');
    });
    it('codex-cli from .codex/config.toml', async () => {
      touch('.codex/config.toml');
      expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
    });
    it('codex-cli from codex.md', async () => {
      touch('codex.md');
      expect(await detectNativeFormat(TEST_DIR)).toBe('codex-cli');
    });
    it('windsurf from .windsurfrules', async () => {
      touch('.windsurfrules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('windsurf');
    });
    it('cline from .clinerules', async () => {
      touch('.clinerules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('cline');
    });
    it('continue from .continue/rules', async () => {
      mkdir('.continue/rules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('continue');
    });
    it('junie from .junie/guidelines.md', async () => {
      touch('.junie/guidelines.md');
      expect(await detectNativeFormat(TEST_DIR)).toBe('junie');
    });
    it('kiro from .kiro/steering', async () => {
      mkdir('.kiro/steering');
      expect(await detectNativeFormat(TEST_DIR)).toBe('kiro');
    });
    it('kilo-code from .kilo/rules', async () => {
      mkdir('.kilo/rules');
      expect(await detectNativeFormat(TEST_DIR)).toBe('kilo-code');
    });
    it('kilo-code from .kilocodemodes', async () => {
      touch('.kilocodemodes');
      expect(await detectNativeFormat(TEST_DIR)).toBe('kilo-code');
    });
  });

  describe('KNOWN_NATIVE_PATHS', () => {
    it('exposes one representative path per descriptor in BUILTIN_TARGETS order', () => {
      expect(KNOWN_NATIVE_PATHS).toHaveLength(BUILTIN_TARGETS.length);
      // First entries match the alphabetical-ordered first descriptors.
      expect(KNOWN_NATIVE_PATHS[0]).toBe(BUILTIN_TARGETS[0]!.detectionPaths[0]);
    });

    it('matches each descriptor`s detectionPaths[0]', () => {
      const expected = BUILTIN_TARGETS.map((d) => d.detectionPaths[0]);
      expect([...KNOWN_NATIVE_PATHS]).toEqual(expected);
    });
  });
});
