import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Lesson } from '../../../src/lessons/graph-schema.js';
import type { MatchedLesson } from '../../../src/lessons/query.js';
import {
  clearSeen,
  commitSeen,
  filterUnseen,
  openSessionDedup,
} from '../../../src/lessons/seen-cache.js';

let counter = 0;
const used: string[] = [];
function uniqueSession(): string {
  const id = `test-${process.pid}-${counter++}`;
  used.push(id);
  return id;
}

afterEach(() => {
  // Targeted cleanup (keeps parallel test files isolated): remove only THIS file's
  // sessions, which may be flat (`${id}.json`) or project-namespaced (`${id}__<hash>.json`).
  const dir = join(tmpdir(), 'agentsmesh-lessons-seen');
  const ids = new Set(used.splice(0));
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const base = entry.replace(/(__[a-z0-9]+)?\.json$/, '');
    if (ids.has(base)) rmSync(join(dir, entry), { force: true });
  }
});

const lesson: Lesson = {
  rule: 'r',
  topics: [],
  triggers: [],
  evidence: [],
  status: 'active',
  createdAt: '2026-06-05',
};
const match = (id: string): MatchedLesson => ({ id, lesson });

describe('openSessionDedup', () => {
  it('returns null when no session correlator is set', () => {
    expect(openSessionDedup({ env: {} })).toBeNull();
  });

  it('returns null when explicitly disabled even with a session id', () => {
    expect(openSessionDedup({ explicit: 's1', disabled: true })).toBeNull();
  });

  it('resolves an explicit session id over the environment', () => {
    const d = openSessionDedup({
      explicit: uniqueSession(),
      env: { AGENTSMESH_SESSION_ID: 's-env' },
    });
    expect(d).not.toBeNull();
    expect(d!.sessionId).toMatch(/^test-/);
  });

  it('falls back to AGENTSMESH_SESSION_ID', () => {
    const id = uniqueSession();
    const d = openSessionDedup({ env: { AGENTSMESH_SESSION_ID: id } });
    expect(d!.sessionId).toBe(id);
  });
});

describe('filterUnseen + commitSeen', () => {
  it('suppresses ids committed earlier in the session and keeps fresh ones', () => {
    const id = uniqueSession();
    const d1 = openSessionDedup({ explicit: id })!;
    // Nothing committed yet → everything is fresh.
    expect(filterUnseen(d1, [match('a'), match('b')]).map((m) => m.id)).toEqual(['a', 'b']);
    commitSeen(d1, ['a']);
    // Re-open reads the persisted seen set.
    const d2 = openSessionDedup({ explicit: id })!;
    expect(filterUnseen(d2, [match('a'), match('b'), match('c')]).map((m) => m.id)).toEqual([
      'b',
      'c',
    ]);
  });

  it('persists the seen set to a per-session temp file', () => {
    const id = uniqueSession();
    commitSeen(openSessionDedup({ explicit: id })!, ['x']);
    expect(existsSync(join(tmpdir(), 'agentsmesh-lessons-seen', `${id}.json`))).toBe(true);
  });

  it('keeps sessions isolated — one session does not see another session ids', () => {
    const id1 = uniqueSession();
    const id2 = uniqueSession();
    commitSeen(openSessionDedup({ explicit: id1 })!, ['a']);
    const d2 = openSessionDedup({ explicit: id2 })!;
    expect(filterUnseen(d2, [match('a')]).map((m) => m.id)).toEqual(['a']);
  });

  it('namespaces by project root — the SAME session id in two projects is isolated', () => {
    const id = uniqueSession();
    // Project A marks lesson "a" seen under a shared session id.
    commitSeen(openSessionDedup({ explicit: id, projectRoot: '/tmp/projA' })!, ['a']);
    // Project B, same session id, must NOT inherit A's seen set.
    const b = openSessionDedup({ explicit: id, projectRoot: '/tmp/projB' })!;
    expect(filterUnseen(b, [match('a')]).map((m) => m.id)).toEqual(['a']);
    // Same project A re-open DOES see it (dedup still works within a project).
    const a2 = openSessionDedup({ explicit: id, projectRoot: '/tmp/projA' })!;
    expect(filterUnseen(a2, [match('a')]).map((m) => m.id)).toEqual([]);
  });
});

describe('seen-cache — robustness branches', () => {
  it('treats a non-array seen-cache file as empty (corrupt or foreign content)', () => {
    const id = uniqueSession();
    const d1 = openSessionDedup({ explicit: id });
    expect(d1).not.toBeNull();
    mkdirSync(dirname(d1!.path), { recursive: true });
    writeFileSync(d1!.path, JSON.stringify({ not: 'an array' }));
    const d2 = openSessionDedup({ explicit: id });
    expect(d2!.seen.size).toBe(0);
  });

  it('clearSeen discards the session set so ids are fresh again', () => {
    const id = uniqueSession();
    commitSeen(openSessionDedup({ explicit: id })!, ['a']);
    expect(filterUnseen(openSessionDedup({ explicit: id })!, [match('a')])).toEqual([]);
    clearSeen(id);
    // After the reset, "a" is unseen again.
    expect(
      filterUnseen(openSessionDedup({ explicit: id })!, [match('a')]).map((m) => m.id),
    ).toEqual(['a']);
  });

  it('clearSeen namespaces by project root (only that project is reset)', () => {
    const id = uniqueSession();
    commitSeen(openSessionDedup({ explicit: id, projectRoot: '/tmp/pA' })!, ['a']);
    commitSeen(openSessionDedup({ explicit: id, projectRoot: '/tmp/pB' })!, ['a']);
    clearSeen(id, '/tmp/pA');
    // pA reset → "a" fresh; pB untouched → "a" still seen.
    expect(
      filterUnseen(openSessionDedup({ explicit: id, projectRoot: '/tmp/pA' })!, [match('a')]).map(
        (m) => m.id,
      ),
    ).toEqual(['a']);
    expect(
      filterUnseen(openSessionDedup({ explicit: id, projectRoot: '/tmp/pB' })!, [match('a')]),
    ).toEqual([]);
  });

  it('clearSeen is a safe no-op when nothing was committed', () => {
    expect(() => clearSeen(uniqueSession())).not.toThrow();
  });

  it('commitSeen writes nothing when every returned id was already seen', () => {
    const id = uniqueSession();
    commitSeen(openSessionDedup({ explicit: id })!, ['a', 'b']);
    const reopened = openSessionDedup({ explicit: id })!;
    commitSeen(reopened, ['a']); // union size === seen size → early return, no write
    const after = openSessionDedup({ explicit: id })!;
    expect([...after.seen].sort()).toEqual(['a', 'b']);
  });
});
