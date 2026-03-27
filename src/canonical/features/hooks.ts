/**
 * Parse .agentsmesh/hooks.yaml into Hooks.
 */

import { parse as parseYaml } from 'yaml';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import type { HookEntry, Hooks } from '../../core/types.js';
import { getHookText, getHookPrompt } from '../../core/hook-command.js';

const VALID_TYPES = ['command', 'prompt'] as const;

function toHookEntry(raw: unknown): HookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const matcher = obj.matcher;
  if (typeof matcher !== 'string') return null;
  const command = getHookText(obj);
  if (!command) return null;
  const type =
    typeof obj.type === 'string' && VALID_TYPES.includes(obj.type as (typeof VALID_TYPES)[number])
      ? (obj.type as 'command' | 'prompt')
      : undefined;
  const timeout =
    typeof obj.timeout === 'number' && Number.isFinite(obj.timeout) ? obj.timeout : undefined;
  const prompt = getHookPrompt(obj) || undefined;
  return {
    matcher,
    command,
    ...(timeout !== undefined && { timeout }),
    ...(type && { type }),
    ...(prompt && { prompt }),
  };
}

/**
 * Parse hooks.yaml at the given path.
 * @param hooksPath - Absolute path to .agentsmesh/hooks.yaml
 * @returns Hooks or null if file missing or malformed
 */
export async function parseHooks(hooksPath: string): Promise<Hooks | null> {
  const content = await readFileSafe(hooksPath);
  if (content === null) return null;
  if (!content.trim()) return {};
  let parsed: unknown;
  try {
    parsed = parseYaml(content) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const result: Hooks = {};
  const obj = parsed as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (!Array.isArray(val)) continue;
    const entries: HookEntry[] = [];
    for (const item of val) {
      const entry = toHookEntry(item);
      if (entry) entries.push(entry);
    }
    if (entries.length > 0) result[key] = entries;
  }
  return result;
}
