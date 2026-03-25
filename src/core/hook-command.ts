type HookLike = {
  command?: unknown;
  prompt?: unknown;
  type?: unknown;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getHookCommand(entry: HookLike): string {
  return trimString(entry.command);
}

export function getHookPrompt(entry: HookLike): string {
  return trimString(entry.prompt);
}

export function getHookText(entry: HookLike): string {
  const command = getHookCommand(entry);
  const prompt = getHookPrompt(entry);
  return entry.type === 'prompt' ? prompt || command : command || prompt;
}

export function hasHookCommand(entry: HookLike): boolean {
  return getHookCommand(entry).length > 0;
}

export function hasHookText(entry: HookLike): boolean {
  return getHookText(entry).length > 0;
}
