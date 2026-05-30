import type { LessonsCluster } from './index-schema.js';

export interface ScoredCluster {
  cluster: LessonsCluster;
  score: number;
}

export function scoreBullet(bullet: string, clusters: readonly LessonsCluster[]): ScoredCluster[] {
  const lower = bullet.toLowerCase();
  return clusters
    .map((cluster): ScoredCluster => {
      const t = cluster.triggers;
      const kwHits = t.keywords.filter((k) => lower.includes(k.toLowerCase())).length;
      const pathHits = t.file_globs.filter((g) => {
        const stem = g
          .replace(/[*{}[\]?!]/g, '')
          .replace(/\/+/g, '/')
          .trim();
        return stem.length > 2 && lower.includes(stem.toLowerCase());
      }).length;
      const cmdHits = t.command_patterns.filter((p) => {
        try {
          return new RegExp(p, 'i').test(bullet);
        } catch {
          return false;
        }
      }).length;
      return { cluster, score: kwHits * 2 + pathHits + cmdHits };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
