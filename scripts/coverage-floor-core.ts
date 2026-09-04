/**
 * Per-file coverage floor. Vitest's `thresholds` are aggregate (or, with
 * `perFile`, apply the same numbers everywhere), so a 0%-covered module can
 * hide inside a 95% total. This pass reads the json-summary report and fails
 * on any file under the floor. Pure logic; the CLI entry is coverage-floor.ts.
 */

export interface MetricSummary {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface FileSummary {
  lines: MetricSummary;
  functions: MetricSummary;
  branches: MetricSummary;
  statements: MetricSummary;
}

export type CoverageSummary = Record<string, FileSummary>;

export interface Floor {
  lines: number;
  functions: number;
  branches: number;
}

export interface Miss {
  metric: keyof Floor;
  pct: number;
  covered: number;
  total: number;
  floor: number;
}

export interface Offender {
  file: string;
  misses: Miss[];
}

/** Deliberately below the 95% aggregate: this is the "is it tested at all" net. */
export const DEFAULT_FLOOR: Floor = { lines: 80, functions: 80, branches: 70 };

const METRICS: readonly (keyof Floor)[] = ['lines', 'functions', 'branches'];

export function filesBelowFloor(summary: CoverageSummary, floor: Floor): Offender[] {
  const offenders: Offender[] = [];
  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total') continue;
    const misses: Miss[] = [];
    for (const metric of METRICS) {
      const m = data[metric];
      if (m.total === 0 || m.pct >= floor[metric]) continue;
      misses.push({ metric, pct: m.pct, covered: m.covered, total: m.total, floor: floor[metric] });
    }
    if (misses.length > 0) offenders.push({ file, misses });
  }
  return offenders;
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function relativeTo(root: string, file: string): string {
  const posixRoot = toPosix(root).replace(/\/$/, '');
  const posixFile = toPosix(file);
  return posixFile.startsWith(`${posixRoot}/`) ? posixFile.slice(posixRoot.length + 1) : posixFile;
}

export function formatOffenders(offenders: readonly Offender[], root: string): string[] {
  return offenders.map((o) => {
    const parts = o.misses.map(
      (m) => `${m.metric} ${m.pct}% (${m.covered}/${m.total}) < ${m.floor}%`,
    );
    return `${relativeTo(root, o.file)}  ${parts.join(', ')}`;
  });
}
