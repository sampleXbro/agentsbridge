import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Document, parseDocument, YAMLMap, YAMLSeq } from 'yaml';

/**
 * Auto-wire hook-mode recall: inject `agentsmesh lessons hook` into canonical
 * `.agentsmesh/hooks.yaml` under BOTH `PreToolUse` (guards the FIRST touch of a
 * file — recall injects BEFORE the edit) and `PostToolUse` (covers later actions
 * and harnesses that support only post-call injection), so `generate` projects
 * them to every hook-capable target and recall becomes deterministic (no extra
 * model turn, no compliance dependence). Targets without hook support have no
 * hooks generator, so they keep relying on the always-on lessons paragraph in
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
const RECALL_HOOK_MATCHER = 'Edit|Write|Bash';
/** PreToolUse guards the first touch (inject before the edit); PostToolUse is the fallback. */
const RECALL_EVENTS = ['PreToolUse', 'PostToolUse'] as const;

/** Add the recall command to one event's hook list. Returns true when it was added. */
function injectEvent(doc: Document, event: string): boolean {
  const existing = doc.get(event);
  const seq = existing instanceof YAMLSeq ? existing : new YAMLSeq();
  const present = seq.items.some(
    (item) => item instanceof YAMLMap && item.get('command') === RECALL_HOOK_COMMAND,
  );
  if (present) return false;
  seq.add(
    doc.createNode({ matcher: RECALL_HOOK_MATCHER, type: 'command', command: RECALL_HOOK_COMMAND }),
  );
  doc.set(event, seq);
  return true;
}

/** Returns true when a hook was added to either event; false when already present or no hooks.yaml. */
export function injectRecallHook(projectRoot: string): boolean {
  const path = join(projectRoot, '.agentsmesh', 'hooks.yaml');
  if (!existsSync(path)) return false;

  // Document API (not parse→stringify) so the schema directive + comments survive.
  const doc = parseDocument(readFileSync(path, 'utf8'));
  let changed = false;
  for (const event of RECALL_EVENTS) {
    if (injectEvent(doc, event)) changed = true;
  }
  if (changed) writeFileSync(path, String(doc), 'utf8');
  return changed;
}
