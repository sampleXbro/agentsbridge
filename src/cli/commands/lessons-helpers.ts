import type { LessonsGraph } from '../../lessons/graph-schema.js';
import type { LessonsCommandResult, LessonsQueryFormat } from './lessons-types.js';

export type LessonsFlags = Record<string, string | boolean | string[]>;

export function stringFlag(flags: LessonsFlags, name: string): string | null {
  const v = flags[name];
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

export function listFlag(flags: LessonsFlags, name: string): string[] {
  const v = flags[name];
  if (v === undefined || v === false || v === true) return [];
  if (Array.isArray(v)) return v.filter((s) => s.length > 0);
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseFormat(flags: LessonsFlags): LessonsQueryFormat {
  const raw = stringFlag(flags, 'format');
  if (raw === 'md' || raw === 'json' || raw === 'plain') return raw;
  return 'plain';
}

export function queryFromFlags(flags: LessonsFlags): {
  file?: string;
  command?: string;
  keyword?: string;
} {
  const out: { file?: string; command?: string; keyword?: string } = {};
  const file = stringFlag(flags, 'file');
  const command = stringFlag(flags, 'cmd') ?? stringFlag(flags, 'command');
  const keyword = stringFlag(flags, 'keyword');
  if (file !== null) out.file = file;
  if (command !== null) out.command = command;
  if (keyword !== null) out.keyword = keyword;
  return out;
}

export function emptyGraph(): LessonsGraph {
  return { version: 1, lessons: {}, topics: {}, triggers: {} };
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function renderTopicMarkdown(
  id: string,
  summary: string,
  lessons: Array<[string, LessonsGraph['lessons'][string]]>,
): string {
  const lines = [`# ${id}`, '', summary, '', '## Lessons', ''];
  for (const [lessonId, lesson] of lessons) {
    lines.push(`- **${lessonId}** — ${lesson.rule}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Subcommands that can fail with a user-facing error and a placeholder data shape. */
type ErrorableSubcommand = 'add' | 'show' | 'deprecate' | 'import-md';

export function errorResult(
  subcommand: ErrorableSubcommand,
  message: string,
  exitCode: number,
): LessonsCommandResult {
  switch (subcommand) {
    case 'add':
      return {
        subcommand,
        exitCode,
        error: message,
        data: { id: '', isNewLesson: false, isNewTopic: false, newTriggerIds: [] },
      };
    case 'show':
      return { subcommand, exitCode, error: message, data: { topic: '', markdown: '' } };
    case 'deprecate':
      return { subcommand, exitCode, error: message, data: { id: '', supersededBy: null } };
    case 'import-md':
      return {
        subcommand,
        exitCode,
        error: message,
        data: {
          topicCount: 0,
          lessonCount: 0,
          triggerCount: 0,
          wroteGraphPath: '',
          deletedPaths: [],
        },
      };
  }
}
