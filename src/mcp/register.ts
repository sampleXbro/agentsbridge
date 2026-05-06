import { z } from 'zod';
import { toJSONSchema } from 'zod/v4/core';
import { rulesHandlers } from './handlers/rules.js';
import { commandsHandlers } from './handlers/commands.js';
import { agentsHandlers } from './handlers/agents.js';
import { skillsHandlers } from './handlers/skills.js';
import { settingsHandlers } from './handlers/settings.js';
import { capabilitiesHandlers } from './handlers/capabilities.js';
import { orchestrateHandlers } from './handlers/orchestrate.js';
import type { McpContext } from './context.js';
import type { CanonicalHandlers } from './handlers/canonical-factory.js';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: McpContext, input: unknown) => Promise<unknown>;
  resourceUri?: string;
}

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  read: (ctx: McpContext, params: Record<string, string>) => Promise<unknown>;
}

export function zodToMcpSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = toJSONSchema(schema, { target: 'draft-07' }) as Record<string, unknown>;
  delete json['$schema'];
  return json;
}

const NoInput = z.object({}).strict();
const NameInput = z.object({ name: z.string().describe('Item name (e.g. "auth", "code-review")') });
const FrontmatterInput = z.object({
  name: z.string().describe('Item name (e.g. "auth", "code-review")'),
  frontmatter: z
    .record(z.string(), z.unknown())
    .describe('YAML frontmatter fields (e.g. { description, globs, targets })'),
  body: z.string().describe('Markdown body content'),
  dry_run: z.boolean().optional().describe('Preview changes without writing to disk'),
});

function canonicalTools(
  feature: 'rule' | 'command' | 'agent',
  h: CanonicalHandlers<unknown>,
): ToolDescriptor[] {
  const plural = feature === 'rule' ? 'rules' : feature === 'command' ? 'commands' : 'agents';
  return [
    {
      name: `list_${plural}`,
      description: `List ${plural} with summary metadata`,
      inputSchema: NoInput,
      handler: (ctx) => h.list(ctx),
      resourceUri: `agentsmesh://canonical/${plural}`,
    },
    {
      name: `get_${feature}`,
      description: `Get a single ${feature} by name`,
      inputSchema: NameInput,
      handler: (ctx, i) => h.get(ctx, i as { name: string }),
      resourceUri: `agentsmesh://canonical/${plural}/{name}`,
    },
    {
      name: `create_${feature}`,
      description: `Create a new ${feature}`,
      inputSchema: FrontmatterInput,
      handler: (ctx, i) => h.create(ctx, i as never),
    },
    {
      name: `update_${feature}`,
      description: `Update a ${feature}. Default: replace frontmatter entirely. Set merge=true to shallow-merge. Omitting body preserves the existing body.`,
      inputSchema: z.object({
        name: z.string().describe('Name of the item to update'),
        frontmatter: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'New frontmatter fields (replaces by default; set merge=true to shallow-merge)',
          ),
        body: z.string().optional().describe('New markdown body (omit to preserve existing)'),
        merge: z
          .boolean()
          .optional()
          .describe('If true, shallow-merge frontmatter instead of replacing'),
        dry_run: z.boolean().optional().describe('Preview changes without writing to disk'),
      }),
      handler: (ctx, i) => h.update(ctx, i as never),
    },
    {
      name: `delete_${feature}`,
      description: `Delete a ${feature}. For rules: deleting _root requires force=true.`,
      inputSchema: z.object({
        name: z.string().describe('Name of the item to delete'),
        force: z.boolean().optional().describe('Required to delete protected files like _root'),
        dry_run: z.boolean().optional().describe('Preview without deleting'),
      }),
      handler: (ctx, i) => h.delete(ctx, i as never),
    },
  ];
}

export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  // canonical content (15 = 5 × 3 features)
  ...canonicalTools('rule', rulesHandlers as CanonicalHandlers<unknown>),
  ...canonicalTools('command', commandsHandlers as CanonicalHandlers<unknown>),
  ...canonicalTools('agent', agentsHandlers as CanonicalHandlers<unknown>),
  // skills (6)
  {
    name: 'list_skills',
    description: 'List skills',
    inputSchema: NoInput,
    handler: (ctx) => skillsHandlers.list(ctx),
    resourceUri: 'agentsmesh://canonical/skills',
  },
  {
    name: 'get_skill',
    description: 'Get one skill (frontmatter + body + supporting filenames)',
    inputSchema: NameInput,
    handler: (ctx, i) => skillsHandlers.get(ctx, i as { name: string }),
    resourceUri: 'agentsmesh://canonical/skills/{name}',
  },
  {
    name: 'get_skill_file',
    description: 'Read a skill supporting file by name and relative path',
    inputSchema: z.object({
      name: z.string().describe('Skill name'),
      path: z.string().describe('Relative path within the skill directory (e.g. "helper.md")'),
    }),
    handler: (ctx, i) => skillsHandlers.getFile(ctx, i as never),
    resourceUri: 'agentsmesh://canonical/skills/{name}/files/{path}',
  },
  {
    name: 'create_skill',
    description: 'Create a skill directory with SKILL.md and optional supporting files',
    inputSchema: z.object({
      name: z.string().describe('Skill name (becomes directory name)'),
      frontmatter: z.record(z.string(), z.unknown()).describe('YAML frontmatter for SKILL.md'),
      body: z.string().describe('Markdown body for SKILL.md'),
      supportingFiles: z
        .record(z.string(), z.string())
        .optional()
        .describe('Map of relative-path → content for supporting files'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => skillsHandlers.create(ctx, i as never),
  },
  {
    name: 'update_skill',
    description:
      'Update a skill. supportingFiles: string value writes/replaces, null deletes, unlisted files are untouched.',
    inputSchema: z.object({
      name: z.string().describe('Skill name'),
      frontmatter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('New frontmatter (replaces by default; merge=true to shallow-merge)'),
      body: z.string().optional().describe('New body (omit to preserve existing)'),
      merge: z.boolean().optional().describe('Shallow-merge frontmatter instead of replacing'),
      supportingFiles: z
        .record(z.string(), z.union([z.string(), z.null()]))
        .optional()
        .describe('Map of path → content (string=write, null=delete, absent=keep)'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => skillsHandlers.update(ctx, i as never),
  },
  {
    name: 'delete_skill',
    description: 'Delete a skill',
    inputSchema: z.object({ name: z.string(), dry_run: z.boolean().optional() }),
    handler: (ctx, i) => skillsHandlers.delete(ctx, i as never),
  },
  // settings reads (5)
  {
    name: 'get_config',
    description: 'Read agentsmesh.yaml',
    inputSchema: NoInput,
    handler: (ctx) => settingsHandlers.getConfig(ctx),
    resourceUri: 'agentsmesh://config',
  },
  {
    name: 'list_mcp_servers',
    description: 'List MCP servers in canonical mcp.json',
    inputSchema: NoInput,
    handler: (ctx) => settingsHandlers.listMcpServers(ctx),
    resourceUri: 'agentsmesh://canonical/mcp',
  },
  {
    name: 'get_permissions',
    description: 'Read permissions.yaml',
    inputSchema: NoInput,
    handler: (ctx) => settingsHandlers.getPermissions(ctx),
    resourceUri: 'agentsmesh://canonical/permissions',
  },
  {
    name: 'get_hooks',
    description: 'Read hooks.yaml',
    inputSchema: NoInput,
    handler: (ctx) => settingsHandlers.getHooks(ctx),
    resourceUri: 'agentsmesh://canonical/hooks',
  },
  {
    name: 'get_ignore',
    description: 'Read ignore patterns',
    inputSchema: NoInput,
    handler: (ctx) => settingsHandlers.getIgnore(ctx),
    resourceUri: 'agentsmesh://canonical/ignore',
  },
  // settings writes (7)
  {
    name: 'update_config',
    description:
      'Update agentsmesh.yaml. Default: replace listed fields. Set merge=true to union arrays and shallow-merge objects. Only writes agentsmesh.yaml, never agentsmesh.local.yaml.',
    inputSchema: z.object({
      targets: z
        .array(z.string())
        .optional()
        .describe('Target tool IDs (e.g. ["claude-code", "cursor"])'),
      features: z
        .array(z.string())
        .optional()
        .describe('Feature names (e.g. ["rules", "commands", "mcp"])'),
      conversions: z.record(z.string(), z.unknown()).optional().describe('Conversion overrides'),
      merge: z
        .boolean()
        .optional()
        .describe('If true, union arrays and shallow-merge objects instead of replacing'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => settingsHandlers.updateConfig(ctx, i as never),
  },
  {
    name: 'add_mcp_server',
    description: 'Add an MCP server entry to .agentsmesh/mcp.json. Fails if name already exists.',
    inputSchema: z.object({
      name: z.string().describe('Server name (e.g. "github", "filesystem")'),
      server: z
        .record(z.string(), z.unknown())
        .describe(
          'Server config (e.g. { type: "stdio", command: "npx", args: [...], env: {...} })',
        ),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => settingsHandlers.addMcpServer(ctx, i as never),
  },
  {
    name: 'update_mcp_server',
    description: 'Update an MCP server entry (replace or merge)',
    inputSchema: z.object({
      name: z.string(),
      server: z.record(z.string(), z.unknown()),
      merge: z.boolean().optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => settingsHandlers.updateMcpServer(ctx, i as never),
  },
  {
    name: 'remove_mcp_server',
    description: 'Remove an MCP server entry',
    inputSchema: z.object({ name: z.string(), dry_run: z.boolean().optional() }),
    handler: (ctx, i) => settingsHandlers.removeMcpServer(ctx, i as never),
  },
  {
    name: 'update_permissions',
    description:
      'Update permissions.yaml. mode=replace (default) overwrites listed fields; mode=append unions and dedups.',
    inputSchema: z.object({
      allow: z
        .array(z.string())
        .optional()
        .describe('Allowed tool patterns (e.g. ["Bash(npm run:*)"])'),
      deny: z.array(z.string()).optional().describe('Denied tool patterns'),
      ask: z.array(z.string()).optional().describe('Tools requiring confirmation'),
      mode: z
        .enum(['replace', 'append'])
        .optional()
        .describe('replace=overwrite, append=union+dedup (default: replace)'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => settingsHandlers.updatePermissions(ctx, i as never),
  },
  {
    name: 'update_hooks',
    description:
      'Replace hooks.yaml content entirely. Read current hooks with get_hooks, modify, then write back.',
    inputSchema: z.object({
      hooks: z
        .record(z.string(), z.array(z.unknown()))
        .describe('Full hooks structure (e.g. { PreToolUse: [...], PostToolUse: [...] })'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => settingsHandlers.updateHooks(ctx, i as never),
  },
  {
    name: 'update_ignore',
    description:
      'Update .agentsmesh/ignore patterns. mode=replace (default) overwrites; mode=append adds new patterns.',
    inputSchema: z.object({
      patterns: z
        .array(z.string())
        .describe('Gitignore-syntax patterns (e.g. ["node_modules/", "dist/", ".env*"])'),
      mode: z
        .enum(['replace', 'append'])
        .optional()
        .describe('replace=overwrite, append=add (default: replace)'),
      dry_run: z.boolean().optional().describe('Preview without writing'),
    }),
    handler: (ctx, i) => settingsHandlers.updateIgnore(ctx, i as never),
  },
  // capabilities (2)
  {
    name: 'list_target_capabilities',
    description: 'List support matrix for all targets',
    inputSchema: NoInput,
    handler: () => capabilitiesHandlers.list(),
    resourceUri: 'agentsmesh://capabilities',
  },
  {
    name: 'get_target_capabilities',
    description:
      'Get feature support levels for a specific target (e.g. which features are native, mapped, or unsupported)',
    inputSchema: z.object({
      targetId: z.string().describe('Target tool ID (e.g. "claude-code", "cursor")'),
    }),
    handler: (_, i) => capabilitiesHandlers.get(i as never),
    resourceUri: 'agentsmesh://capabilities/{targetId}',
  },
  // orchestration (6)
  {
    name: 'generate',
    description:
      'Generate target-native config files from canonical .agentsmesh/ content. Propagates rules, commands, agents, skills, MCP, hooks, ignore, and permissions to all configured targets.',
    inputSchema: z.object({
      targets: z
        .array(z.string())
        .optional()
        .describe('Filter to specific targets (default: all from agentsmesh.yaml)'),
      features: z.array(z.string()).optional().describe('Filter to specific features'),
      verbose: z.boolean().optional().describe('Include full file list in response'),
      dry_run: z.boolean().optional().describe('Preview without writing files'),
    }),
    handler: (ctx, i) => orchestrateHandlers.generate(ctx, i as never),
  },
  {
    name: 'lint',
    description:
      'Lint canonical .agentsmesh/ files for schema errors, missing frontmatter, and other issues',
    inputSchema: z.object({
      severity: z
        .enum(['error', 'warning', 'info'])
        .optional()
        .describe('Filter results by minimum severity'),
    }),
    handler: (ctx, i) => orchestrateHandlers.lint(ctx, i as never),
  },
  {
    name: 'check',
    description: 'Detect drift between canonical and lockfile',
    inputSchema: NoInput,
    handler: (ctx) => orchestrateHandlers.check(ctx),
  },
  {
    name: 'diff',
    description: 'Preview what generate would create, modify, or delete without writing',
    inputSchema: z.object({
      targets: z.array(z.string()).optional().describe('Filter to specific targets'),
      features: z.array(z.string()).optional().describe('Filter to specific features'),
    }),
    handler: (ctx, i) => orchestrateHandlers.diff(ctx, i as never),
  },
  {
    name: 'import',
    description:
      "Import another tool's native config into canonical .agentsmesh/. Note: dry_run is not supported (the engine writes directly).",
    inputSchema: z.object({
      from: z.string().describe('Source target ID to import from (e.g. "cursor", "claude-code")'),
      features: z.array(z.string()).optional().describe('Restrict import to specific features'),
      dry_run: z
        .boolean()
        .optional()
        .describe('NOT SUPPORTED — will throw VALIDATION_FAILED. Use diff instead.'),
    }),
    handler: (ctx, i) => orchestrateHandlers.import(ctx, i as never),
  },
  {
    name: 'convert',
    description:
      'Convert config directly from one tool to another (e.g. Cursor → Claude Code) without creating canonical .agentsmesh/ files',
    inputSchema: z.object({
      from: z.string().describe('Source target ID (e.g. "cursor")'),
      to: z.string().describe('Destination target ID (e.g. "claude-code")'),
      dry_run: z.boolean().optional().describe('Preview conversion without writing files'),
    }),
    handler: (ctx, i) => orchestrateHandlers.convert(ctx, i as never),
  },
];

export const RESOURCE_DESCRIPTORS: ResourceDescriptor[] = TOOL_DESCRIPTORS.filter(
  (d) => d.resourceUri !== undefined,
).map((d) => ({
  uri: d.resourceUri!,
  name: d.name,
  description: d.description,
  read: (ctx, params) => d.handler(ctx, params),
}));
