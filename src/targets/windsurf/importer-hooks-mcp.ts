import { dirname, join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import {
  WINDSURF_TARGET,
  WINDSURF_HOOKS_FILE,
  WINDSURF_MCP_EXAMPLE_FILE,
  WINDSURF_MCP_CONFIG_FILE,
  WINDSURF_CANONICAL_HOOKS,
  WINDSURF_CANONICAL_MCP,
} from './constants.js';

export async function importWindsurfHooks(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const hooksPath = join(projectRoot, WINDSURF_HOOKS_FILE);
  const hooksContent = await readFileSafe(hooksPath);
  if (!hooksContent) return;
  try {
    const parsed = JSON.parse(hooksContent) as Record<string, unknown>;
    if (!parsed.hooks || typeof parsed.hooks !== 'object' || Array.isArray(parsed.hooks)) return;
    const canonical = windsurfHooksToCanonical(parsed.hooks as Record<string, unknown>);
    if (Object.keys(canonical).length === 0) return;
    const destPath = join(projectRoot, WINDSURF_CANONICAL_HOOKS);
    await mkdirp(dirname(destPath));
    await writeFileAtomic(destPath, yamlStringify(canonical));
    results.push({
      fromTool: WINDSURF_TARGET,
      fromPath: hooksPath,
      toPath: WINDSURF_CANONICAL_HOOKS,
      feature: 'hooks',
    });
  } catch {
    // Invalid hooks JSON should not fail import.
  }
}

function canonicalHookEventName(event: string): string {
  const explicit: Record<string, string> = {
    pre_tool_use: 'PreToolUse',
    post_tool_use: 'PostToolUse',
    notification: 'Notification',
    user_prompt_submit: 'UserPromptSubmit',
    subagent_start: 'SubagentStart',
    subagent_stop: 'SubagentStop',
  };
  return explicit[event] ?? event;
}

function windsurfHooksToCanonical(hooks: Record<string, unknown>): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    const mappedEvent = canonicalHookEventName(event);
    const canonicalEntries: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;

      if (typeof e.command === 'string' && e.command.trim()) {
        canonicalEntries.push({
          matcher: '.*',
          type: 'command',
          command: e.command,
        });
        continue;
      }

      const matcher = typeof e.matcher === 'string' && e.matcher.trim() ? e.matcher : '.*';
      const hooksList = Array.isArray(e.hooks) ? e.hooks : [];
      for (const item of hooksList) {
        if (!item || typeof item !== 'object') continue;
        const hook = item as Record<string, unknown>;
        const command =
          typeof hook.command === 'string'
            ? hook.command
            : typeof hook.prompt === 'string'
              ? hook.prompt
              : '';
        if (!command.trim()) continue;
        const canonical: Record<string, unknown> = {
          matcher,
          type: hook.type === 'prompt' ? 'prompt' : 'command',
          command,
        };
        if (typeof hook.timeout === 'number') canonical.timeout = hook.timeout;
        canonicalEntries.push(canonical);
      }
    }
    if (canonicalEntries.length > 0) result[mappedEvent] = canonicalEntries;
  }
  return result;
}

export async function importWindsurfMcp(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const sourceCandidates = [WINDSURF_MCP_EXAMPLE_FILE, WINDSURF_MCP_CONFIG_FILE];
  for (const relPath of sourceCandidates) {
    const srcPath = join(projectRoot, relPath);
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') continue;
      const destPath = join(projectRoot, WINDSURF_CANONICAL_MCP);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, JSON.stringify({ mcpServers: parsed.mcpServers }, null, 2));
      results.push({
        fromTool: WINDSURF_TARGET,
        fromPath: srcPath,
        toPath: WINDSURF_CANONICAL_MCP,
        feature: 'mcp',
      });
      return;
    } catch {
      // Invalid MCP JSON should not fail import.
    }
  }
}
