import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, YAMLMap, YAMLSeq } from 'yaml';

/**
 * Auto-wire hook-mode recall: inject a `PostToolUse` hook that runs
 * `agentsmesh lessons hook` into canonical `.agentsmesh/hooks.yaml`, so `generate`
 * projects it to every hook-capable target and recall becomes deterministic there
 * (no extra model turn, no compliance dependence). Targets without hook support
 * have no hooks generator, so they simply keep relying on the always-on lessons
 * paragraph in their root instruction — the universal fallback.
 *
 * Idempotent by COMMAND value (re-running scaffold never duplicates the entry),
 * and edited via the YAML Document API so the file's `# yaml-language-server`
 * schema directive and example comments survive — a parse()→stringify() round-trip
 * would silently drop them.
 *
 * Only injects into an EXISTING `hooks.yaml` — it never force-creates one, so a
 * project that does not use hooks is left untouched (and `init` always scaffolds
 * `hooks.yaml` before this runs, so the `init --lessons` flow is covered).
 */

export const RECALL_HOOK_COMMAND = 'agentsmesh lessons hook';
const RECALL_HOOK_MATCHER = 'Edit|Write|Bash';

/** Returns true when the hook was added; false when already present or no hooks.yaml. */
export function injectRecallHook(projectRoot: string): boolean {
  const path = join(projectRoot, '.agentsmesh', 'hooks.yaml');
  if (!existsSync(path)) return false;

  // Document API (not parse→stringify) so the schema directive + comments survive.
  const doc = parseDocument(readFileSync(path, 'utf8'));
  const existing = doc.get('PostToolUse');
  const post = existing instanceof YAMLSeq ? existing : new YAMLSeq();
  const present = post.items.some(
    (item) => item instanceof YAMLMap && item.get('command') === RECALL_HOOK_COMMAND,
  );
  if (present) return false;

  post.add(
    doc.createNode({ matcher: RECALL_HOOK_MATCHER, type: 'command', command: RECALL_HOOK_COMMAND }),
  );
  doc.set('PostToolUse', post);
  writeFileSync(path, String(doc), 'utf8');
  return true;
}
