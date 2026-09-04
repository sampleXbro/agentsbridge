/**
 * Rule-scoped merge for `~/.gemini/policies/permissions.toml`.
 *
 * The file is the tool's own User-tier policy directory (`~/.gemini/policies/*.toml`),
 * and `permissions.toml` is a filename agentsmesh picked out of that glob — a
 * user may already be writing rules there by hand. Its whole body is `[[rule]]`
 * blocks, so ownership cannot be key-scoped: it is recorded in the file, one
 * `# agentsmesh:` comment above every generated block, the same way
 * `.aider.conf.yml` records it (`targets/aider/conf-merge.ts`).
 *
 *   - a MARKED block -> agentsmesh's, replaced by this run's output, which is
 *     how a permission removed from canonical stops applying;
 *   - an UNMARKED block -> the user's, re-emitted verbatim. This is what keeps
 *     `decision = "ask_user"` rules and rules for tools outside agentsmesh's
 *     tool-name map, neither of which agentsmesh can generate or import back.
 *
 * A file written by an older agentsmesh has no markers, so its blocks would
 * survive as "the user's" and duplicate this run's output. Blocks whose rule
 * body is byte-identical to a generated one are therefore dropped as well.
 */

import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { GEMINI_GLOBAL_POLICIES_FILE, GEMINI_DEFAULT_POLICIES_FILE } from './constants.js';

/** Written above every `[[rule]]` agentsmesh emits; its presence is the ownership proof. */
export const GEMINI_POLICY_MARKER = '# agentsmesh: generated from .agentsmesh/permissions.yaml';

const RULE_HEADER = /^\s*\[\[rule\]\]\s*$/;

function isComment(line: string): boolean {
  return line.trim().startsWith('#');
}

/**
 * Split a policy file into its `[[rule]]` blocks. Comment lines DIRECTLY above a
 * header belong to that block, so a marker stays with the rule it marks; a blank
 * line ends the run, which keeps a file-level header comment out of the first
 * block and therefore safe from replacement.
 *
 * @returns Leading text that precedes every rule, plus one entry per block
 */
export function splitPolicyBlocks(content: string): { header: string; blocks: string[] } {
  const lines = content.split('\n');
  const starts: number[] = [];
  lines.forEach((line, idx) => {
    if (RULE_HEADER.test(line)) starts.push(idx);
  });
  if (starts.length === 0) return { header: content, blocks: [] };

  const boundaries = starts.map((start) => {
    let from = start;
    while (from > 0 && isComment(lines[from - 1]!)) from -= 1;
    return from;
  });

  const blocks: string[] = [];
  for (let i = 0; i < boundaries.length; i += 1) {
    const end = i + 1 < boundaries.length ? boundaries[i + 1]! : lines.length;
    blocks.push(lines.slice(boundaries[i]!, end).join('\n'));
  }
  return { header: lines.slice(0, boundaries[0]!).join('\n'), blocks };
}

/** The block without its comment lines, so two blocks compare on rule body alone. */
function ruleBody(block: string): string {
  return block
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');
}

function isOwned(block: string, generatedBodies: ReadonlySet<string>): boolean {
  return block.includes('# agentsmesh') || generatedBodies.has(ruleBody(block));
}

/**
 * @returns The user's rules followed by this run's, or `newContent` when there
 * is no base to merge into.
 */
export function mergeGeminiPolicies(base: string | null, newContent: string): string {
  if (base === null || base.trim() === '') return newContent;
  const { header, blocks } = splitPolicyBlocks(base);
  const generatedBodies = new Set(splitPolicyBlocks(newContent).blocks.map(ruleBody));
  const kept = blocks.filter((block) => !isOwned(block, generatedBodies));

  const parts = [header.trim(), ...kept.map((block) => block.trim()), newContent.trim()];
  return parts.filter((part) => part !== '').join('\n\n') + '\n';
}

export const mergeGeminiPolicyRules: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  resolvedPath === GEMINI_GLOBAL_POLICIES_FILE || resolvedPath === GEMINI_DEFAULT_POLICIES_FILE
    ? mergeGeminiPolicies(pending?.content ?? existing, newContent)
    : null;
