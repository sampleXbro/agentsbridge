import { z } from 'zod';
import { skillsHandlers } from '../handlers/skills.js';
import type { ToolDescriptor } from './types.js';

const NoInput = z.object({}).strict();
const NameInput = z.object({ name: z.string().describe('Item name') });

export const SKILL_TOOL_DESCRIPTORS: ToolDescriptor[] = [
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
];
