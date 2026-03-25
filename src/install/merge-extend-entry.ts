/**
 * Merge a new install extend entry into an existing extends list (same source updates).
 */

import type { ExtendPick, ValidatedConfig } from '../config/schema.js';

type ExtEntry = ValidatedConfig['extends'][number];

export interface NewExtendEntry {
  name: string;
  source: string;
  version?: string;
  features: ExtEntry['features'];
  path?: string;
  pick?: ExtendPick;
  target?: ExtEntry['target'];
}

export function assertExtendNameAvailable(
  extendsList: { name: string; source: string }[],
  entry: NewExtendEntry,
): void {
  const hit = extendsList.find((e) => e.name === entry.name && e.source !== entry.source);
  if (hit) {
    throw new Error(
      `Extends entry "${entry.name}" already exists with a different source. Use --name to provide a different name.`,
    );
  }
}

function mergePick(
  oldPick: ExtendPick | undefined,
  incomingFeatures: string[],
  incomingPick: ExtendPick | undefined,
): ExtendPick | undefined {
  if (incomingPick === undefined) {
    if (!oldPick) return undefined;
    const out: ExtendPick = { ...oldPick };
    for (const k of ['skills', 'commands', 'rules', 'agents'] as const) {
      if (incomingFeatures.includes(k)) {
        delete out[k];
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  const out: ExtendPick = { ...oldPick };
  for (const k of ['skills', 'commands', 'rules', 'agents'] as const) {
    if (!(k in incomingPick)) continue;
    const bv = incomingPick[k];
    if (bv === undefined || bv.length === 0) {
      delete out[k];
      continue;
    }
    out[k] = [...new Set([...(oldPick?.[k] ?? []), ...bv])];
  }
  return Object.keys(out).length ? out : undefined;
}

export function mergeExtendList(
  existing: ValidatedConfig['extends'],
  incoming: NewExtendEntry,
): ValidatedConfig['extends'] {
  const idx = existing.findIndex((e) => e.source === incoming.source);
  if (idx < 0) {
    return [
      ...existing,
      {
        name: incoming.name,
        source: incoming.source,
        version: incoming.version,
        features: incoming.features,
        path: incoming.path,
        pick: incoming.pick,
        target: incoming.target,
      },
    ];
  }

  const old = existing[idx]!;
  const features = [...new Set([...old.features, ...incoming.features])] as ExtEntry['features'];
  const pick = mergePick(old.pick, incoming.features as string[], incoming.pick);

  return existing.map((e, i) =>
    i === idx
      ? {
          name: incoming.name,
          source: incoming.source,
          version: incoming.version ?? old.version,
          features,
          path: incoming.path !== undefined ? incoming.path : old.path,
          pick,
          target: (incoming.target ?? old.target) as ExtEntry['target'],
        }
      : e,
  );
}
