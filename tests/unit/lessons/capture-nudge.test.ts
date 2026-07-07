import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCaptureNudge, CAPTURE_NUDGE_SENTINEL } from '../../../src/lessons/capture-nudge.js';

let counter = 0;
const sessions: string[] = [];
function uniqueSession(): string {
  const id = `nudge-${process.pid}-${counter++}`;
  sessions.push(id);
  return id;
}

beforeEach(() => {
  vi.stubEnv('AGENTSMESH_SESSION_ID', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const id of sessions.splice(0)) {
    rmSync(join(tmpdir(), 'agentsmesh-lessons-seen', `${id}.json`), { force: true });
  }
});

describe('buildCaptureNudge', () => {
  it('pre-fills --trigger-file with the failed file path', () => {
    const ctx = buildCaptureNudge({ file: 'src/x.ts' });
    expect(ctx).toContain("--trigger-file 'src/x.ts'");
    expect(ctx).toContain('lessons add');
  });

  it('steers the trigger to the recurrence surface, not just the discovery file', () => {
    const ctx = buildCaptureNudge({ file: 'src/x.ts' });
    expect(ctx).toContain('Trigger where it will RECUR');
    expect(ctx).toContain('file-CLASS');
  });

  it('pre-fills --trigger-cmd when only a command failed', () => {
    const ctx = buildCaptureNudge({ command: 'pnpm test' });
    expect(ctx).toContain('--trigger-cmd');
  });

  it('falls back to a generic --trigger-file hint when neither file nor command is present', () => {
    const ctx = buildCaptureNudge({});
    expect(ctx).toContain("--trigger-file '<glob>'");
  });

  it('fires at most once per session', () => {
    const sessionId = uniqueSession();
    expect(buildCaptureNudge({ command: 'x', sessionId })).not.toBeNull();
    expect(buildCaptureNudge({ command: 'x', sessionId })).toBeNull();
  });

  it('is not deduped when no session correlator is present (fires each time)', () => {
    expect(buildCaptureNudge({ command: 'x' })).not.toBeNull();
    expect(buildCaptureNudge({ command: 'x' })).not.toBeNull();
  });

  it('exposes a sentinel that cannot collide with a real kebab-case lesson id', () => {
    expect(CAPTURE_NUDGE_SENTINEL).toMatch(/^__.*__$/);
  });
});

describe('buildCaptureNudge — recurrence escalation (STORE)', () => {
  it('escalates when the action recurred and no lesson covers it, surfacing the error class', () => {
    const ctx = buildCaptureNudge({
      command: 'npm run build',
      failures: 2,
      covered: false,
      lastErrorClass: 'typeerror: boom',
    });
    expect(ctx).toContain('has failed 2×');
    expect(ctx).toContain('no lesson covers it');
    expect(ctx).toContain('typeerror: boom');
    expect(ctx).toContain('--trigger-cmd');
  });

  it('does NOT escalate when a lesson already covers the recurring failure', () => {
    expect(buildCaptureNudge({ command: 'x', failures: 5, covered: true })).not.toContain(
      'has failed',
    );
  });

  it('does NOT escalate on the first failure of an action', () => {
    expect(buildCaptureNudge({ command: 'x', failures: 1, covered: false })).not.toContain(
      'has failed',
    );
  });

  it('omits the error-class note when lastErrorClass is undefined', () => {
    const ctx = buildCaptureNudge({ command: 'npm run build', failures: 2, covered: false });
    expect(ctx).toContain('has failed 2×');
    expect(ctx).not.toContain('The recurring error');
  });

  it('the two tiers dedup independently — generic then recurrence each fire once', () => {
    const sessionId = uniqueSession();
    expect(buildCaptureNudge({ command: 'x', sessionId, failures: 1, covered: false })).toContain(
      'just failed',
    );
    expect(buildCaptureNudge({ command: 'x', sessionId, failures: 1, covered: false })).toBeNull(); // generic deduped
    expect(buildCaptureNudge({ command: 'x', sessionId, failures: 2, covered: false })).toContain(
      'has failed 2×',
    );
    expect(buildCaptureNudge({ command: 'x', sessionId, failures: 3, covered: false })).toBeNull(); // recurrence deduped
  });
});
