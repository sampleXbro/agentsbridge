import type { HookEntry } from '../../core/types.js';
import { hasHookCommand as hasNonEmptyHookCommand } from '../../core/hook-command.js';

export function hasHookCommand(entry: HookEntry): boolean {
  return hasNonEmptyHookCommand(entry);
}
