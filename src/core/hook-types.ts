/** Hook definition */
export interface HookEntry {
  matcher: string;
  command: string;
  timeout?: number;
  type?: 'command' | 'prompt';
  prompt?: string;
}

export interface Hooks {
  PreToolUse?: HookEntry[];
  PostToolUse?: HookEntry[];
  Notification?: HookEntry[];
  UserPromptSubmit?: HookEntry[];
  SubagentStart?: HookEntry[];
  SubagentStop?: HookEntry[];
  [key: string]: HookEntry[] | undefined;
}
