/**
 * Windsurf target importer — .windsurfrules, .windsurf/rules/*.md, .windsurfignore → canonical.
 * .windsurfrules is flat (no frontmatter); we add root: true on import.
 * .windsurf/rules/*.md preserves frontmatter.
 */

import { join, dirname, relative } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { stringify as yamlStringify } from 'yaml';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import {
  removePathIfExists,
  shouldImportScopedAgentsRule,
} from '../import/scoped-agents-import.js';
import {
  WINDSURF_TARGET,
  WINDSURF_RULES_ROOT,
  WINDSURF_RULES_DIR,
  WINDSURF_IGNORE,
  CODEIUM_IGNORE,
  WINDSURF_AGENTS_MD,
  WINDSURF_HOOKS_FILE,
  WINDSURF_MCP_EXAMPLE_FILE,
  WINDSURF_MCP_CONFIG_FILE,
  WINDSURF_CANONICAL_RULES_DIR,
  WINDSURF_CANONICAL_IGNORE,
  WINDSURF_CANONICAL_HOOKS,
  WINDSURF_CANONICAL_MCP,
} from './constants.js';
import { importWorkflows } from './workflows-skills-helpers.js';
import { importSkills } from './skills-adapter.js';

/**
 * Import Windsurf config into canonical .agentsmesh/.
 * Sources: .windsurfrules (root), .windsurf/rules/*.md (rules), .windsurfignore (ignore).
 *
 * @param projectRoot - Project root directory (repo root, or user home for global scope)
 * @param options - When `scope` is `global`, skips recursive nested `AGENTS.md` discovery under `projectRoot`.
 * @returns Import results for each imported file
 */
export async function importFromWindsurf(
  projectRoot: string,
  options?: { scope?: TargetLayoutScope },
): Promise<ImportResult[]> {
  const layoutScope: TargetLayoutScope = options?.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(WINDSURF_TARGET, projectRoot);
  const normalizeCodex = await createImportReferenceNormalizer('codex-cli', projectRoot);
  const destRulesDir = join(projectRoot, WINDSURF_CANONICAL_RULES_DIR);

  const rootPath = join(projectRoot, WINDSURF_RULES_ROOT);
  const rootContent = await readFileSafe(rootPath);
  if (rootContent !== null) {
    await mkdirp(destRulesDir);
    const destPath = join(destRulesDir, '_root.md');
    const body = normalize(rootContent, rootPath, destPath).trim();
    const outContent = await serializeImportedRuleWithFallback(destPath, { root: true }, body);
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'windsurf',
      fromPath: rootPath,
      toPath: `${WINDSURF_CANONICAL_RULES_DIR}/_root.md`,
      feature: 'rules',
    });
  }

  // Fallback: AGENTS.md when .windsurfrules absent
  if (rootContent === null) {
    const agentsMdPath = join(projectRoot, WINDSURF_AGENTS_MD);
    const agentsMdContent = await readFileSafe(agentsMdPath);
    if (agentsMdContent !== null) {
      await mkdirp(destRulesDir);
      const destPath = join(destRulesDir, '_root.md');
      const body = normalize(
        normalizeCodex(agentsMdContent, agentsMdPath, destPath),
        agentsMdPath,
        destPath,
      ).trim();
      const outContent = await serializeImportedRuleWithFallback(destPath, { root: true }, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'windsurf',
        fromPath: agentsMdPath,
        toPath: `${WINDSURF_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
  }

  if (layoutScope !== 'global') {
    results.push(
      ...(await importFileDirectory({
        srcDir: projectRoot,
        destDir: destRulesDir,
        extensions: ['AGENTS.md'],
        fromTool: 'windsurf',
        normalize,
        mapEntry: async ({ srcPath, normalizeTo }) => {
          const relDir = relative(projectRoot, dirname(srcPath)).replace(/\\/g, '/');
          if (!relDir || relDir === '.' || !srcPath.endsWith('/AGENTS.md')) return null;
          const ruleName = relDir.replace(/\//g, '-');
          if (!shouldImportScopedAgentsRule(relDir)) {
            await removePathIfExists(join(destRulesDir, `${ruleName}.md`));
            return null;
          }
          const destPath = join(destRulesDir, `${ruleName}.md`);
          return {
            destPath,
            toPath: `${WINDSURF_CANONICAL_RULES_DIR}/${ruleName}.md`,
            feature: 'rules',
            content: await serializeImportedRuleWithFallback(
              destPath,
              { root: false, globs: [`${relDir}/**`] },
              normalizeTo(destPath),
            ),
          };
        },
      })),
    );
  }

  const rulesDir = join(projectRoot, WINDSURF_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: rulesDir,
      destDir: destRulesDir,
      extensions: ['.md'],
      fromTool: 'windsurf',
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        if (relativePath === '_root.md' && rootContent !== null) return null;
        const destPath = join(destRulesDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const normalizedFrontmatter: Record<string, unknown> = { ...frontmatter };
        if (typeof normalizedFrontmatter.glob === 'string' && normalizedFrontmatter.glob.trim()) {
          normalizedFrontmatter.globs = [normalizedFrontmatter.glob];
          delete normalizedFrontmatter.glob;
        }
        return {
          destPath,
          toPath: `${WINDSURF_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(
            destPath,
            { ...normalizedFrontmatter, root: false },
            body,
          ),
        };
      },
    })),
  );

  let ignorePath = join(projectRoot, WINDSURF_IGNORE);
  let ignoreContent = await readFileSafe(ignorePath);
  if (ignoreContent === null || !ignoreContent.trim()) {
    ignorePath = join(projectRoot, CODEIUM_IGNORE);
    ignoreContent = await readFileSafe(ignorePath);
  }
  if (ignoreContent !== null && ignoreContent.trim()) {
    const lines = ignoreContent.split(/\r?\n/);
    const patterns: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (t && !t.startsWith('#')) patterns.push(t);
    }
    if (patterns.length > 0) {
      await mkdirp(join(projectRoot, '.agentsmesh'));
      const destIgnorePath = join(projectRoot, WINDSURF_CANONICAL_IGNORE);
      await writeFileAtomic(destIgnorePath, patterns.join('\n'));
      results.push({
        fromTool: 'windsurf',
        fromPath: ignorePath,
        toPath: WINDSURF_CANONICAL_IGNORE,
        feature: 'ignore',
      });
    }
  }

  await importWorkflows(projectRoot, results, normalize);
  await importSkills(projectRoot, results, normalize);
  await importHooks(projectRoot, results);
  await importMcp(projectRoot, results);

  return results;
}

async function importHooks(projectRoot: string, results: ImportResult[]): Promise<void> {
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

      // Native Windsurf shape: { command, show_output? }.
      if (typeof e.command === 'string' && e.command.trim()) {
        canonicalEntries.push({
          matcher: '.*',
          type: 'command',
          command: e.command,
        });
        continue;
      }

      // Backward compatibility for previously emitted cursor-style shape.
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

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
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
