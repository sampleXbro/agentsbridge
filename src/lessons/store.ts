import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseIndex, type LessonsCluster, type LessonsIndex } from './index-schema.js';
import { matchTriggers, type ToolEvent } from './matcher.js';
import { lessonsPaths } from './paths.js';

export interface TriggeredLesson {
  readonly cluster: LessonsCluster;
  readonly relativePath: string;
  readonly filePath: string;
  readonly content: string;
}

export interface LessonCaptureInput {
  readonly heading: string;
  readonly whatWentWrong: string;
  readonly rootCause: string;
  readonly rule: string;
}

export interface AppendLessonResult {
  readonly journalPath: string;
  readonly bullet: string;
  readonly lineNumber: number;
}

export function loadLessonsIndex(projectRoot: string): LessonsIndex {
  const raw = readFileSync(lessonsPaths(projectRoot).index, 'utf8');
  return parseIndex(parseYaml(raw) as unknown);
}

export function readTriggeredLessons(projectRoot: string, event: ToolEvent): TriggeredLesson[] {
  const index = loadLessonsIndex(projectRoot);
  const contentByPath = new Map<string, string>();

  return matchTriggers(index.clusters, normalizeToolEvent(projectRoot, event)).map(
    (cluster): TriggeredLesson => {
      const filePath = resolveProjectFile(projectRoot, cluster.file);
      let content = contentByPath.get(cluster.file);
      if (content === undefined) {
        content = readFileSync(filePath, 'utf8');
        contentByPath.set(cluster.file, content);
      }

      return {
        cluster,
        relativePath: cluster.file,
        filePath,
        content,
      };
    },
  );
}

export function formatLessonBullet(input: LessonCaptureInput): string {
  const heading = compact(input.heading);
  if (heading.length === 0) throw new Error('Lesson heading must not be empty.');

  return [
    `- **${heading}**:`,
    sentence(input.whatWentWrong),
    sentence(input.rootCause),
    sentence(input.rule),
  ].join(' ');
}

export function appendLessonToJournal(
  projectRoot: string,
  input: LessonCaptureInput,
): AppendLessonResult {
  const journalPath = lessonsPaths(projectRoot).journal;
  const bullet = formatLessonBullet(input);
  const current = existsSync(journalPath) ? readFileSync(journalPath, 'utf8') : '';
  const prefix = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  const lineNumber = nextLineNumber(current);

  mkdirSync(dirname(journalPath), { recursive: true });
  appendFileSync(journalPath, `${prefix}${bullet}\n`, 'utf8');

  return { journalPath, bullet, lineNumber };
}

function resolveProjectFile(projectRoot: string, relPath: string): string {
  if (isAbsolute(relPath) || /^[A-Za-z]:[\\/]/.test(relPath)) {
    throw new Error(`Lessons file must be project-relative: ${relPath}`);
  }

  const root = resolve(projectRoot);
  const filePath = resolve(root, relPath);
  const backToRoot = relative(root, filePath);
  if (backToRoot === '' || backToRoot.startsWith('..') || isAbsolute(backToRoot)) {
    throw new Error(`Lessons file escapes the project root: ${relPath}`);
  }

  return filePath;
}

function normalizeToolEvent(projectRoot: string, event: ToolEvent): ToolEvent {
  if (event.kind !== 'edit' && event.kind !== 'write') return event;
  return { ...event, filePath: normalizeEventPath(projectRoot, event.filePath) };
}

function normalizeEventPath(projectRoot: string, filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const root = resolve(projectRoot).replaceAll('\\', '/');
  if (normalized === root) return '.';
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  return normalized.replace(/^\.\//, '');
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sentence(value: string): string {
  const compacted = compact(value);
  if (compacted.length === 0) throw new Error('Lesson sentence must not be empty.');
  return /[.!?]$/.test(compacted) ? compacted : `${compacted}.`;
}

function nextLineNumber(current: string): number {
  if (current.length === 0) return 1;
  const lineCount = current.split('\n').length;
  return current.endsWith('\n') ? lineCount : lineCount + 1;
}
