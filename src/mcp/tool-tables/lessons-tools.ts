import { z } from 'zod';
import { lessonsHandlers } from '../handlers/lessons.js';
import type { ToolDescriptor } from './types.js';

const LessonsQueryInput = z
  .object({
    file: z.string().optional().describe('Project-relative path of the file about to be edited.'),
    command: z.string().optional().describe('Shell command about to be executed.'),
    keyword: z.string().optional().describe('Free-form description of the active task.'),
  })
  .strict();

const LessonsAddInput = z
  .object({
    rule: z.string().min(1).describe('Imperative rule that prevents recurrence.'),
    topic: z.string().min(1).describe('Topic id. Use new_topic + topic_summary to create one.'),
    trigger_files: z
      .array(z.string())
      .optional()
      .describe('file_glob triggers (e.g. ["src/cli/**/*.ts"])'),
    trigger_commands: z
      .array(z.string())
      .optional()
      .describe('command_pattern triggers — regexes matched against shell commands.'),
    trigger_keywords: z
      .array(z.string())
      .optional()
      .describe('keyword triggers — case-insensitive substrings of task descriptions.'),
    evidence: z
      .array(z.string())
      .optional()
      .describe('Evidence references (commit:SHA, lesson:id, …).'),
    rationale: z.string().optional().describe('Optional one-line "why" behind the rule.'),
    new_topic: z.boolean().optional().describe('Allow creating a new topic if missing.'),
    topic_summary: z
      .string()
      .optional()
      .describe('Required when new_topic creates a topic. One-line summary.'),
  })
  .strict();

export const LESSONS_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: 'lessons_query',
    description:
      'Recall primitive — return active lessons whose triggers match the supplied (file, command, keyword) predicates. OR across triggers. Excludes deprecated and superseded lessons.',
    inputSchema: LessonsQueryInput,
    handler: (ctx, i) => lessonsHandlers.query(ctx, i as never),
  },
  {
    name: 'lessons_add',
    description:
      'Capture primitive — atomically add a new lesson. Deduplicates triggers against the graph. Idempotent on repeat (same rule + topic → same id, no duplicate triggers).',
    inputSchema: LessonsAddInput,
    handler: (ctx, i) => lessonsHandlers.add(ctx, i as never),
  },
];
