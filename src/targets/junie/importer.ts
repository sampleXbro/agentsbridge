import { basename, join } from 'node:path';
import type { ImportResult, McpServer } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/import-reference-rewriter.js';
import { readFileSafe, writeFileAtomic } from '../../utils/fs.js';
import { parseFrontmatter, serializeFrontmatter } from '../../utils/markdown.js';
import { importEmbeddedSkills } from '../embedded-skill.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import-metadata.js';
import { importFileDirectory } from '../import-orchestrator.js';
import { toStringArray, toStringRecord } from '../shared-import-helpers.js';
import {
  JUNIE_TARGET,
  JUNIE_AGENTS_DIR,
  JUNIE_AGENTS_FALLBACK,
  JUNIE_COMMANDS_DIR,
  JUNIE_DOT_AGENTS,
  JUNIE_CI_GUIDELINES,
  JUNIE_GUIDELINES,
  JUNIE_IGNORE,
  JUNIE_MCP_FILE,
  JUNIE_RULES_DIR,
  JUNIE_SKILLS_DIR,
  JUNIE_CANONICAL_ROOT_RULE,
  JUNIE_CANONICAL_RULES_DIR,
  JUNIE_CANONICAL_COMMANDS_DIR,
  JUNIE_CANONICAL_AGENTS_DIR,
  JUNIE_CANONICAL_MCP,
  JUNIE_CANONICAL_IGNORE,
} from './constants.js';

function readMcpServers(content: string): Record<string, McpServer> {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const rawServers = parsed.mcpServers;
  if (!rawServers || typeof rawServers !== 'object' || Array.isArray(rawServers)) return {};

  const servers: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(rawServers)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const server = value as Record<string, unknown>;
    if (typeof server.command === 'string') {
      servers[name] = {
        type: typeof server.type === 'string' ? server.type : 'stdio',
        command: server.command,
        args: toStringArray(server.args),
        env: toStringRecord(server.env),
        description: typeof server.description === 'string' ? server.description : undefined,
      };
      continue;
    }
    if (typeof server.url === 'string') {
      servers[name] = {
        type: typeof server.type === 'string' ? server.type : 'http',
        url: server.url,
        headers: toStringRecord(server.headers),
        env: toStringRecord(server.env),
        description: typeof server.description === 'string' ? server.description : undefined,
      };
    }
  }
  return servers;
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const sources = [JUNIE_DOT_AGENTS, JUNIE_GUIDELINES, JUNIE_CI_GUIDELINES, JUNIE_AGENTS_FALLBACK];
  const destPath = join(projectRoot, JUNIE_CANONICAL_ROOT_RULE);

  for (const relPath of sources) {
    const srcPath = join(projectRoot, relPath);
    const content = await readFileSafe(srcPath);
    if (content === null) continue;
    const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
    const output = await serializeImportedRuleWithFallback(
      destPath,
      {
        root: true,
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
      },
      body,
    );
    await writeFileAtomic(destPath, output);
    results.push({
      fromTool: JUNIE_TARGET,
      fromPath: srcPath,
      toPath: JUNIE_CANONICAL_ROOT_RULE,
      feature: 'rules',
    });
    return;
  }
}

async function importNonRootRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, JUNIE_RULES_DIR);
  const destDir = join(projectRoot, JUNIE_CANONICAL_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'junie',
      normalize,
      mapEntry: async ({ srcPath, normalizeTo }) => {
        const name = basename(srcPath, '.md');
        if (!name) return null;
        const destPath = join(destDir, `${name}.md`);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const output = await serializeImportedRuleWithFallback(
          destPath,
          {
            root: false,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
          },
          body,
        );
        return {
          destPath,
          toPath: `${JUNIE_CANONICAL_RULES_DIR}/${name}.md`,
          feature: 'rules',
          content: output,
        };
      },
    })),
  );
}

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const srcPath = join(projectRoot, JUNIE_MCP_FILE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;

  const servers = readMcpServers(content);
  if (Object.keys(servers).length === 0) return;

  await writeFileAtomic(
    join(projectRoot, JUNIE_CANONICAL_MCP),
    JSON.stringify({ mcpServers: servers }, null, 2),
  );
  results.push({
    fromTool: JUNIE_TARGET,
    fromPath: srcPath,
    toPath: JUNIE_CANONICAL_MCP,
    feature: 'mcp',
  });
}

async function importCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, JUNIE_COMMANDS_DIR);
  const destDir = join(projectRoot, JUNIE_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'junie',
      normalize,
      mapEntry: async ({ srcPath, normalizeTo }) => {
        const name = basename(srcPath, '.md');
        if (!name) return null;
        const destPath = join(destDir, `${name}.md`);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const normalized = await serializeImportedCommandWithFallback(
          destPath,
          {
            hasDescription: true,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            hasAllowedTools: true,
            allowedTools: toStringArray(frontmatter['allowed-tools']),
          },
          body,
        );
        return {
          destPath,
          toPath: `${JUNIE_CANONICAL_COMMANDS_DIR}/${name}.md`,
          feature: 'commands',
          content: normalized,
        };
      },
    })),
  );
}

async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, JUNIE_AGENTS_DIR);
  const destDir = join(projectRoot, JUNIE_CANONICAL_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'junie',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) => {
        const name = basename(srcPath, '.md');
        if (!name) return null;
        const destPath = join(destDir, `${name}.md`);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${JUNIE_CANONICAL_AGENTS_DIR}/${name}.md`,
          feature: 'agents',
          content: serializeFrontmatter(frontmatter, body.trim() || ''),
        };
      },
    })),
  );
}

async function importIgnore(projectRoot: string, results: ImportResult[]): Promise<void> {
  const srcPath = join(projectRoot, JUNIE_IGNORE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;

  await writeFileAtomic(join(projectRoot, JUNIE_CANONICAL_IGNORE), content.trimEnd());
  results.push({
    fromTool: JUNIE_TARGET,
    fromPath: srcPath,
    toPath: JUNIE_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}

export async function importFromJunie(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(JUNIE_TARGET, projectRoot);
  await importRules(projectRoot, results, normalize);
  await importNonRootRules(projectRoot, results, normalize);
  await importCommands(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, JUNIE_SKILLS_DIR, JUNIE_TARGET, results, normalize);
  await importMcp(projectRoot, results);
  await importIgnore(projectRoot, results);
  return results;
}
