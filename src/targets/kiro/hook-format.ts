import { stringify as yamlStringify } from 'yaml';
import type { HookEntry, Hooks } from '../../core/types.js';

interface KiroHookAction {
  type: 'agent' | 'command';
  prompt?: string;
  command?: string;
}

interface KiroHookEntry {
  name: string;
  description?: string;
  trigger: string;
  matcher?: string;
  action: KiroHookAction;
  timeout?: number;
  enabled?: boolean;
}

interface KiroHookFile {
  version: 'v1';
  hooks: KiroHookEntry[];
}

const CANONICAL_TO_KIRO_TRIGGER = {
  UserPromptSubmit: 'UserPromptSubmit',
  SubagentStop: 'Stop',
  PreToolUse: 'PreToolUse',
  PostToolUse: 'PostToolUse',
} as const;

const KIRO_TO_CANONICAL = new Map<string, keyof typeof CANONICAL_TO_KIRO_TRIGGER>([
  ['UserPromptSubmit', 'UserPromptSubmit'],
  ['Stop', 'SubagentStop'],
  ['PreToolUse', 'PreToolUse'],
  ['PostToolUse', 'PostToolUse'],
]);

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function hookText(entry: HookEntry): string | undefined {
  return entry.type === 'prompt' ? entry.prompt : entry.command;
}

export function generateKiroHooks(hooks: Hooks): Array<{ name: string; content: string }> {
  const outputs: Array<{ name: string; content: string }> = [];
  for (const [event, entries] of Object.entries(hooks)) {
    const mappedEvent = event as keyof typeof CANONICAL_TO_KIRO_TRIGGER;
    if (!(mappedEvent in CANONICAL_TO_KIRO_TRIGGER) || !Array.isArray(entries)) continue;
    const trigger = CANONICAL_TO_KIRO_TRIGGER[mappedEvent];
    let index = 1;
    for (const entry of entries) {
      const text = hookText(entry);
      if (!text) continue;
      const matcher = entry.matcher && entry.matcher !== '*' ? entry.matcher : undefined;
      const action: KiroHookAction =
        entry.type === 'prompt'
          ? { type: 'agent', prompt: text }
          : { type: 'command', command: text };
      const hookEntry: KiroHookEntry = {
        name: `${toKebab(event)}-${index}`,
        trigger,
        ...(matcher !== undefined && { matcher }),
        action,
      };
      const file: KiroHookFile = {
        version: 'v1',
        hooks: [hookEntry],
      };
      outputs.push({
        name: `${toKebab(event)}-${index}.json`,
        content: JSON.stringify(file, null, 2),
      });
      index += 1;
    }
  }
  return outputs;
}

function toCanonicalEntry(hookEntry: KiroHookEntry): { event: string; entry: HookEntry } | null {
  const canonicalEvent = KIRO_TO_CANONICAL.get(hookEntry.trigger);
  if (!canonicalEvent) return null;
  const matcher = hookEntry.matcher ?? '*';
  if (hookEntry.action.type === 'agent' && typeof hookEntry.action.prompt === 'string') {
    return {
      event: canonicalEvent,
      entry: {
        matcher,
        command: hookEntry.action.prompt,
        prompt: hookEntry.action.prompt,
        type: 'prompt',
      },
    };
  }
  if (hookEntry.action.type === 'command' && typeof hookEntry.action.command === 'string') {
    return {
      event: canonicalEvent,
      entry: { matcher, command: hookEntry.action.command, type: 'command' },
    };
  }
  return null;
}

export function parseKiroHookFile(content: string): { event: string; entry: HookEntry } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const file = parsed as Partial<KiroHookFile>;
  if (!Array.isArray(file.hooks) || file.hooks.length === 0) return null;
  const hookEntry = file.hooks[0];
  if (!hookEntry || typeof hookEntry.trigger !== 'string') return null;
  return toCanonicalEntry(hookEntry as KiroHookEntry);
}

export function serializeCanonicalHooks(hooks: Hooks): string {
  return yamlStringify(hooks).trimEnd();
}
