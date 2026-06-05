import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseGraph, type LessonsGraph } from './graph-schema.js';

const GRAPH_REL_PATH = '.agentsmesh/lessons/lessons.json';

export function graphFilePath(projectRoot: string): string {
  return resolve(projectRoot, GRAPH_REL_PATH);
}

export function loadLessonsGraph(projectRoot: string): LessonsGraph {
  const raw = readFileSync(graphFilePath(projectRoot), 'utf8');
  return parseGraph(JSON.parse(raw));
}

export function tryLoadLessonsGraph(projectRoot: string): LessonsGraph | null {
  if (!existsSync(graphFilePath(projectRoot))) return null;
  return loadLessonsGraph(projectRoot);
}

export function saveLessonsGraph(projectRoot: string, graph: LessonsGraph): void {
  const path = graphFilePath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeGraph(graph), 'utf8');
}

/**
 * Deterministic serialization: every object's keys are emitted in alphabetical
 * order so diffs reflect content changes rather than insertion order. Output
 * always ends with a single trailing newline to keep CRLF/POSIX diffs clean.
 */
export function serializeGraph(graph: LessonsGraph): string {
  return `${JSON.stringify(canonicalize(graph), null, 2)}\n`;
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : 1,
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = canonicalize(v);
    return out;
  }
  return value;
}
