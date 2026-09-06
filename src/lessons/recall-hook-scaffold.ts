import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Document, parseDocument, YAMLMap, YAMLSeq } from 'yaml';

/**
 * Auto-wire hook-mode recall: inject `agentsmesh lessons hook` into canonical
 * `.agentsmesh/hooks.yaml`, so `generate` projects it to every hook-capable target
 * and recall becomes deterministic (no extra model turn, no compliance dependence):
 *
 * - `PreToolUse` — recall injects BEFORE every mutating tool call. It fires on each
 *   call, not only the first touch, so it is the whole tool-call story.
 * - `UserPromptSubmit` — the ONLY event that carries the task text (no `tool_input`),
 *   so it is the sole moment a keyword/conceptual ("general") lesson can recall
 *   against task INTENT rather than a file path / command token. Uses matcher `*`
 *   (prompt events have no tool to match).
 *
 * `PostToolUse` is deliberately NOT wired, and a previously scaffolded entry there
 * is removed. Alongside PreToolUse it re-ran recall for the same action after the
 * fact: a second process and a second context block per tool call, carrying
 * advice that could no longer be applied. Field data showed 63% of recalls
 * arriving within 3s of a same-shaped one. No target injects on PostToolUse
 * without also supporting PreToolUse (aider's post-edit keys run plain commands
 * and cannot inject at all), so nothing is lost.
 *
 * Targets that cannot represent an event drop it on generate (per-target hook
 * projection skips unmapped events), so wiring these everywhere is safe; targets
 * without any hook support keep relying on the always-on lessons paragraph in
 * their root instruction — the universal fallback.
 *
 * Idempotent per (event, COMMAND) — re-running never duplicates an entry — and
 * edited via the YAML Document API so the file's `# yaml-language-server` schema
 * directive and example comments survive (a parse()→stringify() round-trip would
 * silently drop them).
 *
 * Only injects into an EXISTING `hooks.yaml` — it never force-creates one, so a
 * project that does not use hooks is left untouched (and `init` always scaffolds
 * `hooks.yaml` before this runs, so the `init --lessons` flow is covered).
 */

export const RECALL_HOOK_COMMAND = 'agentsmesh lessons hook';
/** Mutating tools the PreToolUse recall guards. */
const RECALL_HOOK_TOOL_MATCHER = 'Edit|Write|Bash';
/**
 * Events the recall hook wires, each with the matcher that event needs. Tool-call
 * events match the mutating tools; `UserPromptSubmit` fires on every prompt (`*`).
 */
const RECALL_EVENTS: ReadonlyArray<{ readonly event: string; readonly matcher: string }> = [
  { event: 'PreToolUse', matcher: RECALL_HOOK_TOOL_MATCHER },
  { event: 'UserPromptSubmit', matcher: '*' },
  // Capture-on-failure nudge (see capture-nudge.ts). BEST-EFFORT: only Claude
  // Code's passthrough hooks emit it; whitelist targets drop it without warning
  // (BEST_EFFORT_HOOK_EVENTS). PostToolUse is success-only, so failures need this.
  { event: 'PostToolUseFailure', matcher: '*' },
  // Reset recall dedup after a context compaction/clear (see hook.ts SessionStart).
  // BEST-EFFORT: targets that can't represent SessionStart just keep dedup as-is.
  { event: 'SessionStart', matcher: '*' },
];

/** Events an older scaffold wired that recall must no longer ride (see above). */
const RETIRED_EVENTS: readonly string[] = ['PostToolUse'];

/**
 * Remove the managed recall entry from one event, leaving the user's own hooks
 * there untouched; drop the key when nothing remains. Returns true when changed.
 */
function removeEvent(doc: Document, event: string): boolean {
  const existing = doc.get(event);
  if (!(existing instanceof YAMLSeq)) return false;
  const kept = existing.items.filter(
    (item) => !(item instanceof YAMLMap && item.get('command') === RECALL_HOOK_COMMAND),
  );
  if (kept.length === existing.items.length) return false;
  if (kept.length === 0) doc.delete(event);
  else existing.items = kept;
  return true;
}

/** Add the recall command to one event's hook list. Returns true when it was added. */
function injectEvent(doc: Document, event: string, matcher: string): boolean {
  const existing = doc.get(event);
  const seq = existing instanceof YAMLSeq ? existing : new YAMLSeq();
  const present = seq.items.some(
    (item) => item instanceof YAMLMap && item.get('command') === RECALL_HOOK_COMMAND,
  );
  if (present) return false;
  seq.add(doc.createNode({ matcher, type: 'command', command: RECALL_HOOK_COMMAND }));
  doc.set(event, seq);
  return true;
}

/** Returns true when a hook was added to any event; false when already present or no hooks.yaml. */
export function injectRecallHook(projectRoot: string): boolean {
  const path = join(projectRoot, '.agentsmesh', 'hooks.yaml');
  if (!existsSync(path)) return false;

  // Document API (not parse→stringify) so the schema directive + comments survive.
  const doc = parseDocument(readFileSync(path, 'utf8'));
  let changed = false;
  for (const { event, matcher } of RECALL_EVENTS) {
    if (injectEvent(doc, event, matcher)) changed = true;
  }
  for (const event of RETIRED_EVENTS) {
    if (removeEvent(doc, event)) changed = true;
  }
  if (changed) writeFileSync(path, String(doc), 'utf8');
  return changed;
}
