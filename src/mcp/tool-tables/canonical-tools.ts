import { z } from 'zod';
import type { CanonicalHandlers } from '../handlers/canonical-factory.js';
import { rulesHandlers } from '../handlers/rules.js';
import { commandsHandlers } from '../handlers/commands.js';
import { agentsHandlers } from '../handlers/agents.js';
import type { ToolDescriptor } from './types.js';

const NameInput = z.object({ name: z.string().describe('Item name (e.g. "auth", "code-review")') });
const FrontmatterInput = z.object({
  name: z.string().describe('Item name (e.g. "auth", "code-review")'),
  frontmatter: z
    .record(z.string(), z.unknown())
    .describe('YAML frontmatter fields (e.g. { description, globs, targets })'),
  body: z.string().describe('Markdown body content'),
  dry_run: z.boolean().optional().describe('Preview changes without writing to disk'),
});

const NoInput = z.object({}).strict();

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

export const CANONICAL_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  ...canonicalTools('rule', rulesHandlers as CanonicalHandlers<unknown>),
  ...canonicalTools('command', commandsHandlers as CanonicalHandlers<unknown>),
  ...canonicalTools('agent', agentsHandlers as CanonicalHandlers<unknown>),
];
