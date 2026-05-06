import { z } from 'zod';
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

const NoInput = z.object({}).strict();
const NameInput = z.object({ name: z.string() });
const FrontmatterInput = z.object({
  name: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
  dry_run: z.boolean().optional(),
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
      description: `Update a ${feature}`,
      inputSchema: z.object({
        name: z.string(),
        frontmatter: z.record(z.string(), z.unknown()).optional(),
        body: z.string().optional(),
        merge: z.boolean().optional(),
        dry_run: z.boolean().optional(),
      }),
      handler: (ctx, i) => h.update(ctx, i as never),
    },
    {
      name: `delete_${feature}`,
      description: `Delete a ${feature}`,
      inputSchema: z.object({
        name: z.string(),
        force: z.boolean().optional(),
        dry_run: z.boolean().optional(),
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
    description: 'Read a skill supporting file',
    inputSchema: z.object({ name: z.string(), path: z.string() }),
    handler: (ctx, i) => skillsHandlers.getFile(ctx, i as never),
    resourceUri: 'agentsmesh://canonical/skills/{name}/files/{path}',
  },
  {
    name: 'create_skill',
    description: 'Create a skill with optional supporting files',
    inputSchema: z.object({
      name: z.string(),
      frontmatter: z.record(z.string(), z.unknown()),
      body: z.string(),
      supportingFiles: z.record(z.string(), z.string()).optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => skillsHandlers.create(ctx, i as never),
  },
  {
    name: 'update_skill',
    description: 'Update a skill (supportingFiles upsert: string=write, null=delete)',
    inputSchema: z.object({
      name: z.string(),
      frontmatter: z.record(z.string(), z.unknown()).optional(),
      body: z.string().optional(),
      merge: z.boolean().optional(),
      supportingFiles: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
      dry_run: z.boolean().optional(),
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
    description: 'Update agentsmesh.yaml (replace or merge)',
    inputSchema: z.object({
      targets: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
      conversions: z.record(z.string(), z.unknown()).optional(),
      merge: z.boolean().optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => settingsHandlers.updateConfig(ctx, i as never),
  },
  {
    name: 'add_mcp_server',
    description: 'Add an MCP server entry to .agentsmesh/mcp.json',
    inputSchema: z.object({
      name: z.string(),
      server: z.record(z.string(), z.unknown()),
      dry_run: z.boolean().optional(),
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
    description: 'Update permissions.yaml (replace or append)',
    inputSchema: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
      ask: z.array(z.string()).optional(),
      mode: z.enum(['replace', 'append']).optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => settingsHandlers.updatePermissions(ctx, i as never),
  },
  {
    name: 'update_hooks',
    description: 'Replace hooks.yaml content (full-file replace)',
    inputSchema: z.object({
      hooks: z.record(z.string(), z.array(z.unknown())),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => settingsHandlers.updateHooks(ctx, i as never),
  },
  {
    name: 'update_ignore',
    description: 'Update ignore patterns (replace or append)',
    inputSchema: z.object({
      patterns: z.array(z.string()),
      mode: z.enum(['replace', 'append']).optional(),
      dry_run: z.boolean().optional(),
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
    description: 'Get capabilities for a target',
    inputSchema: z.object({ targetId: z.string() }),
    handler: (_, i) => capabilitiesHandlers.get(i as never),
    resourceUri: 'agentsmesh://capabilities/{targetId}',
  },
  // orchestration (6)
  {
    name: 'generate',
    description: 'Generate target-native config from canonical',
    inputSchema: z.object({
      targets: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
      verbose: z.boolean().optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => orchestrateHandlers.generate(ctx, i as never),
  },
  {
    name: 'lint',
    description: 'Lint canonical files',
    inputSchema: z.object({ severity: z.enum(['error', 'warning', 'info']).optional() }),
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
    description: 'Preview generation changes',
    inputSchema: z.object({
      targets: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
    }),
    handler: (ctx, i) => orchestrateHandlers.diff(ctx, i as never),
  },
  {
    name: 'import',
    description: 'Import another tool config into canonical',
    inputSchema: z.object({
      from: z.string(),
      features: z.array(z.string()).optional(),
      dry_run: z.boolean().optional(),
    }),
    handler: (ctx, i) => orchestrateHandlers.import(ctx, i as never),
  },
  {
    name: 'convert',
    description: 'Convert directly from one tool to another',
    inputSchema: z.object({
      from: z.string(),
      to: z.string(),
      dry_run: z.boolean().optional(),
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
