import picomatch from 'picomatch';
import type { LessonsCluster } from './index-schema.js';

export type ToolEvent =
  | { kind: 'edit' | 'write'; filePath: string }
  | { kind: 'bash'; command: string }
  | { kind: 'task'; text: string };

function fileMatch(globs: readonly string[], path: string): boolean {
  return globs.some((g) => picomatch(g, { dot: true })(path));
}

function cmdMatch(patterns: readonly string[], cmd: string): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p).test(cmd);
    } catch {
      return false;
    }
  });
}

function kwMatch(keywords: readonly string[], text: string): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function matchTriggers(
  clusters: readonly LessonsCluster[],
  event: ToolEvent,
): LessonsCluster[] {
  return clusters.filter((c) => {
    const t = c.triggers;
    switch (event.kind) {
      case 'edit':
      case 'write':
        return fileMatch(t.file_globs, event.filePath);
      case 'bash':
        return cmdMatch(t.command_patterns, event.command);
      case 'task':
        return kwMatch(t.keywords, event.text);
    }
  });
}
