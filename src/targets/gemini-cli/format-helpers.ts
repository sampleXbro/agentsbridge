/**
 * Gemini CLI format helpers — flexible frontmatter parsing, hook event mapping,
 * and settings processing (MCP, ignore, hooks).
 */

import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { stringify as stringifyYaml } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import { getHookCommand, hasHookCommand } from '../../core/hook-command.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import {
  GEMINI_SETTINGS,
  GEMINI_IGNORE,
  GEMINI_CANONICAL_MCP,
  GEMINI_CANONICAL_HOOKS,
  GEMINI_CANONICAL_IGNORE,
} from './constants.js';

export function mapGeminiHookEvent(event: string): string | null {
  switch (event) {
    case 'BeforeTool':
    case 'preToolUse':
      return 'PreToolUse';
    case 'AfterTool':
    case 'postToolUse':
      return 'PostToolUse';
    case 'Notification':
    case 'notification':
      return 'Notification';
    default:
      return null;
  }
}

/**
 * Parse frontmatter from YAML (---) or TOML (+++). Falls back to empty on parse failure.
 */
export function parseFlexibleFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const yamlOpen = content.indexOf('---');
  const tomlOpen = content.indexOf('+++');
  if (yamlOpen === 0 && (tomlOpen === -1 || yamlOpen <= tomlOpen)) {
    return parseFrontmatter(content);
  }
  if (tomlOpen === 0) {
    const tomlClose = content.indexOf('+++', 3);
    if (tomlClose !== -1) {
      try {
        const tomlStr = content.slice(3, tomlClose).trim();
        const body = content.slice(tomlClose + 3).trim();
        const parsed = tomlStr === '' ? {} : (parseToml(tomlStr) ?? {});
        const frontmatter = parsed as Record<string, unknown>;
        return { frontmatter, body };
      } catch {
        return { frontmatter: {}, body: content.trim() };
      }
    }
  }
  return { frontmatter: {}, body: content.trim() };
}

export async function importGeminiSettings(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const settingsPath = join(projectRoot, GEMINI_SETTINGS);
  const settingsContent = await readFileSafe(settingsPath);
  if (settingsContent === null) return;

  let settings: Record<string, unknown> | undefined;
  try {
    settings = JSON.parse(settingsContent) as Record<string, unknown>;
  } catch {
    // skip malformed settings
  }
  if (!settings) return;

  const mcpServers = settings.mcpServers;
  if (
    mcpServers !== undefined &&
    typeof mcpServers === 'object' &&
    mcpServers !== null &&
    Object.keys(mcpServers).length > 0
  ) {
    const mcpPath = join(projectRoot, GEMINI_CANONICAL_MCP);
    await mkdirp(join(projectRoot, '.agentsmesh'));
    await writeFileAtomic(mcpPath, JSON.stringify({ mcpServers: mcpServers }, null, 2));
    results.push({
      fromTool: 'gemini-cli',
      fromPath: settingsPath,
      toPath: GEMINI_CANONICAL_MCP,
      feature: 'mcp',
    });
  }

  const ignorePatterns = settings.ignorePatterns;
  if (
    Array.isArray(ignorePatterns) &&
    ignorePatterns.length > 0 &&
    ignorePatterns.every((p): p is string => typeof p === 'string')
  ) {
    const ignorePath = join(projectRoot, GEMINI_CANONICAL_IGNORE);
    await mkdirp(join(projectRoot, '.agentsmesh'));
    await writeFileAtomic(ignorePath, ignorePatterns.join('\n') + '\n');
    results.push({
      fromTool: 'gemini-cli',
      fromPath: settingsPath,
      toPath: GEMINI_CANONICAL_IGNORE,
      feature: 'ignore',
    });
  }

  const hooks = settings.hooks;
  if (hooks !== undefined && typeof hooks === 'object' && hooks !== null) {
    const mappedHooks = Object.entries(hooks as Record<string, unknown>).flatMap(
      ([event, value]) => {
        const canonicalEvent = mapGeminiHookEvent(event);
        if (!canonicalEvent || !Array.isArray(value)) return [];
        const mapped = value
          .filter(
            (entry): entry is Record<string, unknown> =>
              entry !== null &&
              typeof entry === 'object' &&
              typeof entry.matcher === 'string' &&
              Array.isArray(entry.hooks),
          )
          .flatMap((entry) =>
            (entry.hooks as unknown[])
              .filter(
                (hook): hook is Record<string, unknown> =>
                  hook !== null && typeof hook === 'object' && hasHookCommand(hook),
              )
              .map((hook) => ({
                matcher: entry.matcher as string,
                command: getHookCommand(hook),
                type: 'command',
                timeout: typeof hook.timeout === 'number' ? hook.timeout : undefined,
              })),
          );
        if (mapped.length === 0) {
          const legacyMapped = value
            .filter(
              (entry): entry is Record<string, unknown> =>
                entry !== null &&
                typeof entry === 'object' &&
                typeof entry.matcher === 'string' &&
                hasHookCommand(entry),
            )
            .map((entry) => ({
              matcher: entry.matcher as string,
              command: getHookCommand(entry),
              type: 'command',
            }));
          return legacyMapped.length > 0 ? [[canonicalEvent, legacyMapped] as const] : [];
        }
        return mapped.length > 0 ? [[canonicalEvent, mapped] as const] : [];
      },
    );
    if (mappedHooks.length > 0) {
      const hooksYaml = Object.fromEntries(mappedHooks);
      const hooksPath = join(projectRoot, GEMINI_CANONICAL_HOOKS);
      await mkdirp(join(projectRoot, '.agentsmesh'));
      await writeFileAtomic(hooksPath, stringifyYaml(hooksYaml, { lineWidth: 0 }).trimEnd());
      results.push({
        fromTool: 'gemini-cli',
        fromPath: settingsPath,
        toPath: GEMINI_CANONICAL_HOOKS,
        feature: 'hooks',
      });
    }
  }
}

export async function importGeminiIgnore(
  projectRoot: string,
  results: ImportResult[],
): Promise<void> {
  const geminiIgnorePath = join(projectRoot, GEMINI_IGNORE);
  const geminiIgnoreContent = await readFileSafe(geminiIgnorePath);
  if (geminiIgnoreContent !== null && geminiIgnoreContent.trim()) {
    const patterns = geminiIgnoreContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    if (patterns.length > 0) {
      await mkdirp(join(projectRoot, '.agentsmesh'));
      const ignorePath = join(projectRoot, GEMINI_CANONICAL_IGNORE);
      await writeFileAtomic(ignorePath, patterns.join('\n') + '\n');
      results.push({
        fromTool: 'gemini-cli',
        fromPath: geminiIgnorePath,
        toPath: GEMINI_CANONICAL_IGNORE,
        feature: 'ignore',
      });
    }
  }
}
