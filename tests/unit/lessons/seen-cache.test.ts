import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Lesson } from '../../../src/lessons/graph-schema.js';
import type { MatchedLesson } from '../../../src/lessons/query.js';
import {
  AUTO_SESSION_IDLE_MS,
  AUTO_SESSION_TTL_MS,
  clearSeen,
  clearSeenForSessionStart,
  commitSeen,
  filterUnseen,
  openSessionDedup,
} from '../../../src/lessons/seen-cache.js';
import { seenStorePath } from '../../../src/lessons/seen-store.js';

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

describe('TTL sessions (auto day-bucket)', () => {
  const HOUR = 60 * 60 * 1000;

  it('suppresses within the TTL and re-delivers after it expires', () => {
    const id = uniqueSession();
    const d1 = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    commitSeen(d1!, ['l1']);
    // Fresh delivery is suppressed on reopen.
    const d2 = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    expect(d2!.seen.has('l1')).toBe(true);
    // Age the stamp past the TTL by hand: the entry must resurface.
    writeFileSync(
      seenStorePath(id),
      JSON.stringify({ v: 2, seen: { l1: Date.now() - 5 * HOUR } }),
      'utf8',
    );
    const d3 = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    expect(d3!.seen.has('l1')).toBe(false);
  });

  it('treats a legacy array store as expired under TTL mode (safe re-delivery)', () => {
    const id = uniqueSession();
    writeFileSync(seenStorePath(id), JSON.stringify(['l1']), 'utf8');
    const d = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    expect(d!.seen.has('l1')).toBe(false);
  });

  it('commit in TTL mode keeps unexpired siblings and drops expired ones', () => {
    const id = uniqueSession();
    // `fresh` must be recent enough that the session is not idle-reset as a
    // whole (see AUTO_SESSION_IDLE_MS) — this case is about per-entry expiry.
    writeFileSync(
      seenStorePath(id),
      JSON.stringify({ v: 2, seen: { fresh: Date.now() - 60_000, stale: Date.now() - 9 * HOUR } }),
      'utf8',
    );
    const d = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    commitSeen(d!, ['l2']);
    const after = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    expect(after!.seen.has('l2')).toBe(true);
    expect(after!.seen.has('fresh')).toBe(true);
    expect(after!.seen.has('stale')).toBe(false);
  });

  it('a v2 store read WITHOUT a ttl suppresses everything (no silent expiry)', () => {
    const id = uniqueSession();
    writeFileSync(
      seenStorePath(id),
      JSON.stringify({ v: 2, seen: { l1: Date.now() - 9 * HOUR } }),
      'utf8',
    );
    const d = openSessionDedup({ explicit: id });
    expect(d!.seen.has('l1')).toBe(true);
  });

  it('an untimed commit PRESERVES a v2 store instead of downgrading it to the legacy array', () => {
    // One correlator, two writers: the CLI `--session auto` path is TTL'd while
    // the hook/MCP path is untimed (they share an id whenever AGENTSMESH_SESSION_ID
    // is exported). If the untimed commit rewrote the store as a bare array it
    // would discard every stamp, and the next TTL read would treat the whole
    // store as expired — silently zeroing dedup for the rest of the session.
    const id = uniqueSession();
    const ttl = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    commitSeen(ttl!, ['l1']);

    const untimed = openSessionDedup({ explicit: id });
    expect(untimed!.seen.has('l1')).toBe(true);
    commitSeen(untimed!, ['l2']);

    const stored: unknown = JSON.parse(readFileSync(seenStorePath(id), 'utf8'));
    expect(Array.isArray(stored)).toBe(false);
    const back = openSessionDedup({ explicit: id, ttlMs: 4 * HOUR });
    expect(back!.seen.has('l1')).toBe(true);
    expect(back!.seen.has('l2')).toBe(true);
  });

  it('resets the whole session when the store has been idle past the gap', () => {
    // A new chat usually starts after a pause. The CLI never learns that a chat
    // ended, so an idle store is the best available signal: everything in it
    // belonged to a context that is gone, and must be delivered again.
    const id = uniqueSession();
    const idle = Date.now() - (AUTO_SESSION_IDLE_MS + 60_000);
    writeFileSync(seenStorePath(id), JSON.stringify({ v: 2, seen: { l1: idle } }), 'utf8');
    const d = openSessionDedup({ explicit: id, ttlMs: AUTO_SESSION_TTL_MS });
    expect(d!.seen.has('l1')).toBe(false);
    // The reset must be durable: committing must not resurrect the stale ids.
    commitSeen(d!, ['l2']);
    const after = openSessionDedup({ explicit: id, ttlMs: AUTO_SESSION_TTL_MS });
    expect(after!.seen.has('l1')).toBe(false);
    expect(after!.seen.has('l2')).toBe(true);
  });

  it('counts a suppressed-only recall as activity, so a busy session is not reset', () => {
    // commitSeen returns early on an empty delivery, so "newest stamp" alone
    // would call a busy session idle and re-deliver everything every 30 minutes.
    // Activity is tracked separately from delivery.
    const id = uniqueSession();
    const old = Date.now() - (AUTO_SESSION_IDLE_MS - 60_000);
    writeFileSync(seenStorePath(id), JSON.stringify({ v: 2, seen: { l1: old } }), 'utf8');
    // A recall that delivers nothing new, just before the gap would elapse.
    const busy = openSessionDedup({ explicit: id, ttlMs: AUTO_SESSION_TTL_MS });
    expect(busy!.seen.has('l1')).toBe(true);
    commitSeen(busy!, []);
    // Past the point where the ORIGINAL stamp would have looked idle.
    const store = JSON.parse(readFileSync(seenStorePath(id), 'utf8')) as { lastAt?: number };
    expect(typeof store.lastAt).toBe('number');
    expect(store.lastAt! - old).toBeGreaterThan(0);
  });

  it('a future-dated stamp (clock skew) never suppresses forever', () => {
    const id = uniqueSession();
    const future = Date.now() + 10 * 60 * 60 * 1000;
    writeFileSync(seenStorePath(id), JSON.stringify({ v: 2, seen: { l1: future } }), 'utf8');
    // An untrustworthy stamp must not suppress: it is reported as infinitely
    // old, so the entry expires instead of pinning the session forever.
    const d = openSessionDedup({ explicit: id, ttlMs: AUTO_SESSION_TTL_MS });
    expect(d!.seen.has('l1')).toBe(false);
  });

  it('keeps suppressing inside the idle gap (an active session is not reset)', () => {
    const id = uniqueSession();
    const recent = Date.now() - Math.floor(AUTO_SESSION_IDLE_MS / 2);
    writeFileSync(seenStorePath(id), JSON.stringify({ v: 2, seen: { l1: recent } }), 'utf8');
    const d = openSessionDedup({ explicit: id, ttlMs: AUTO_SESSION_TTL_MS });
    expect(d!.seen.has('l1')).toBe(true);
  });

  it('caps auto-session suppression at one hour, not four', () => {
    // The ceiling bounds the worst case: a new chat opened with no pause at all
    // inherits the previous chat's suppressions only until this window passes.
    expect(AUTO_SESSION_TTL_MS).toBe(60 * 60 * 1000);
    expect(AUTO_SESSION_IDLE_MS).toBeLessThan(AUTO_SESSION_TTL_MS);
  });

  it('an untimed commit on a legacy store keeps the legacy array shape (no forced migration)', () => {
    // An older binary must keep reading stores written by this one, so an
    // untimed session that never saw a v2 store does not invent one.
    const id = uniqueSession();
    writeFileSync(seenStorePath(id), JSON.stringify(['l1']), 'utf8');
    const d = openSessionDedup({ explicit: id });
    commitSeen(d!, ['l2']);
    expect(JSON.parse(readFileSync(seenStorePath(id), 'utf8'))).toEqual(['l1', 'l2']);
  });
});

describe('clearSeenForSessionStart', () => {
  let prevEnv: string | undefined;
  beforeEach(() => {
    prevEnv = process.env.AGENTSMESH_SESSION_ID;
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.AGENTSMESH_SESSION_ID;
    else process.env.AGENTSMESH_SESSION_ID = prevEnv;
  });

  /** Pin the auto bucket to a test id so we never touch the real day bucket. */
  const pinAutoBucket = (): string => {
    const id = uniqueSession();
    process.env.AGENTSMESH_SESSION_ID = id;
    return id;
  };

  it('startup wipes the CLI auto bucket — a new chat does not inherit suppressions', () => {
    const autoId = pinAutoBucket();
    const d = openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() });
    commitSeen(d!, ['l1']);
    expect(openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1')).toBe(
      true,
    );

    clearSeenForSessionStart('startup', 'harness-session', process.cwd());

    expect(openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1')).toBe(
      false,
    );
  });

  it('compact/clear ALSO wipes the auto bucket — the compacted chat lost those rules too', () => {
    // The harness session store and the CLI `--session auto` store are different
    // files. Clearing only the first left the agent's own CLI recalls suppressed
    // after /compact — hiding rules from a context that no longer holds them.
    const autoId = pinAutoBucket();
    const d = openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() });
    commitSeen(d!, ['l1']);
    clearSeenForSessionStart('compact', 'harness-session', process.cwd());
    expect(
      openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1'),
    ).toBe(false);
  });

  it('an unknown or missing source clears (only `resume` is safe to keep)', () => {
    for (const source of [undefined, '', 'some-future-source']) {
      const autoId = pinAutoBucket();
      const d = openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() });
      commitSeen(d!, ['l1']);
      clearSeenForSessionStart(source, 'harness-session', process.cwd());
      expect(
        openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1'),
      ).toBe(false);
    }
  });

  it('clears the literal day bucket even when the hook process has no env session id', () => {
    // The hook and the CLI are different processes; the CLI may resolve
    // `--session auto` to the day key while the hook sees AGENTSMESH_SESSION_ID
    // (or the reverse). Both candidate keys must be cleared.
    delete process.env.AGENTSMESH_SESSION_ID;
    const dayKey = `auto-${new Date().toISOString().slice(0, 10)}`;
    const d = openSessionDedup({ explicit: dayKey, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() });
    commitSeen(d!, ['l1']);
    process.env.AGENTSMESH_SESSION_ID = uniqueSession(); // hook sees a different id
    clearSeenForSessionStart('startup', 'harness-session', process.cwd());
    expect(
      openSessionDedup({ explicit: dayKey, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1'),
    ).toBe(false);
  });

  it('resume keeps everything — the prior context was restored, not discarded', () => {
    const autoId = pinAutoBucket();
    const d = openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() });
    commitSeen(d!, ['l1']);
    clearSeenForSessionStart('resume', 'harness-session', process.cwd());
    expect(openSessionDedup({ explicit: autoId, ttlMs: AUTO_SESSION_TTL_MS, projectRoot: process.cwd() })!.seen.has('l1')).toBe(
      true,
    );
  });

  it('compact/clear wipes the harness session set (context was discarded)', () => {
    for (const source of ['compact', 'clear'] as const) {
      const harnessId = uniqueSession();
      const d = openSessionDedup({ explicit: harnessId, projectRoot: process.cwd() });
      commitSeen(d!, ['l1']);
      clearSeenForSessionStart(source, harnessId, process.cwd());
      const after = openSessionDedup({ explicit: harnessId, projectRoot: process.cwd() });
      expect(after!.seen.has('l1')).toBe(false);
    }
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
