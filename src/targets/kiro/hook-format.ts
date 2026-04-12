import { stringify as yamlStringify } from 'yaml';
import type { HookEntry, Hooks } from '../../core/types.js';

interface KiroWhen {
  type: string;
  patterns?: string[];
  tools?: string[];
}

interface KiroThen {
  type: 'askAgent' | 'shellCommand';
  prompt?: string;
  command?: string;
}

interface KiroHookFile {
  name: string;
  description?: string;
  version: '1';
  when: KiroWhen;
  then: KiroThen;
}

const CANONICAL_TO_KIRO = {
  UserPromptSubmit: 'promptSubmit',
  SubagentStop: 'agentStop',
  PreToolUse: 'preToolUse',
  PostToolUse: 'postToolUse',
} as const;

const KIRO_TO_CANONICAL = new Map<string, keyof typeof CANONICAL_TO_KIRO>([
  ['promptSubmit', 'UserPromptSubmit'],
  ['agentStop', 'SubagentStop'],
  ['preToolUse', 'PreToolUse'],
  ['postToolUse', 'PostToolUse'],
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

function toWhen(event: keyof typeof CANONICAL_TO_KIRO, matcher: string): KiroWhen {
  const type = CANONICAL_TO_KIRO[event];
  if (event === 'PreToolUse' || event === 'PostToolUse') {
    return { type, tools: [matcher || '*'] };
  }
  return { type };
}

export function generateKiroHooks(hooks: Hooks): Array<{ name: string; content: string }> {
  const outputs: Array<{ name: string; content: string }> = [];
  for (const [event, entries] of Object.entries(hooks)) {
    const mappedEvent = event as keyof typeof CANONICAL_TO_KIRO;
    if (!(mappedEvent in CANONICAL_TO_KIRO) || !Array.isArray(entries)) continue;
    let index = 1;
    for (const entry of entries) {
      const text = hookText(entry);
      if (!text) continue;
      const file: KiroHookFile = {
        name: `${toKebab(event)} ${index}`,
        version: '1',
        when: toWhen(mappedEvent, entry.matcher),
        then:
          entry.type === 'prompt'
            ? { type: 'askAgent', prompt: text }
            : { type: 'shellCommand', command: text },
      };
      outputs.push({
        name: `${toKebab(event)}-${index}.kiro.hook`,
        content: JSON.stringify(file, null, 2),
      });
      index += 1;
    }
  }
  return outputs;
}

function toCanonicalEntry(file: KiroHookFile): { event: string; entry: HookEntry } | null {
  const canonicalEvent = KIRO_TO_CANONICAL.get(file.when.type);
  if (!canonicalEvent) return null;
  const matcher = file.when.tools?.[0] ?? file.when.patterns?.[0] ?? '*';
  if (file.then.type === 'askAgent' && typeof file.then.prompt === 'string') {
    return {
      event: canonicalEvent,
      entry: {
        matcher,
        command: file.then.prompt,
        prompt: file.then.prompt,
        type: 'prompt',
      },
    };
  }
  if (file.then.type === 'shellCommand' && typeof file.then.command === 'string') {
    return {
      event: canonicalEvent,
      entry: { matcher, command: file.then.command, type: 'command' },
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
  const file = parsed as KiroHookFile;
  if (!file.when || !file.then || typeof file.when.type !== 'string') return null;
  return toCanonicalEntry(file);
}

export function serializeCanonicalHooks(hooks: Hooks): string {
  return yamlStringify(hooks).trimEnd();
}
