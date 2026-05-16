/**
 * Multi-signal source classifier.
 *
 * Inspects a fetched filesystem tree and returns one of four `SourceType`s
 * with the evidence that justified the verdict. Used by the install command
 * to decide whether to dispatch to the existing native importer
 * (`tool-native` / `unknown`), the existing canonical loader
 * (`canonical-agentsmesh`), or the new Anthropic-skill-pack aggregator.
 *
 * Decision rule (first match wins):
 *  1. `<root>/.agentsmesh/` exists → `canonical-agentsmesh`
 *  2. PRIMARY signal matches AND total signal score ≥ `SKILL_PACK_THRESHOLD`
 *     → `anthropic-skill-pack`
 *  3. A recognized tool-native directory exists → `tool-native`
 *  4. otherwise → `unknown`
 *
 * The skill-pack threshold is intentionally tuned so a repo with only the
 * primary signal (one accidental `skills/<x>/SKILL.md`) does NOT reach it:
 * at least one secondary signal worth ≥ 0.4 is required.
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  hasAgentsDir,
  hasMultiToolRules,
  hasPerTargetCommands,
  hasReferencesDir,
  hasSkillPackLayout,
  type SignalContext,
} from './signals.js';
import {
  SIGNAL_WEIGHTS,
  SKILL_PACK_THRESHOLD,
  type Classification,
  type Signal,
  type SignalName,
  type SourceType,
} from './types.js';

/**
 * Top-level directories that indicate a single-tool-native source layout.
 * Intentionally narrow: only directories that strongly imply "this repo was
 * shaped for a particular agent tool" — not markers any project might have
 * for unrelated reasons.
 */
const TOOL_NATIVE_DIRS: readonly string[] = [
  '.claude',
  '.cursor',
  '.gemini',
  '.continue',
  '.cline',
  '.codex',
  '.windsurf',
  '.opencode',
  '.copilot',
  '.kiro',
  '.crush',
  '.amp',
  '.augment',
  '.aider',
  '.zed',
  '.roo',
  '.trae',
  '.junie',
  '.kilo',
  '.qwen',
];

/** Deterministic emission order for signals in the Classification result. */
const SIGNAL_ORDER: readonly SignalName[] = [
  'skill-pack-layout',
  'agents-dir',
  'references-dir',
  'multi-tool-rules',
  'per-target-commands',
];

async function dirExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function hasAnyToolNativeDir(contentRoot: string): Promise<boolean> {
  for (const dir of TOOL_NATIVE_DIRS) {
    if (await dirExists(join(contentRoot, dir))) return true;
  }
  return false;
}

function buildSignals(matches: Readonly<Record<SignalName, boolean>>): readonly Signal[] {
  return SIGNAL_ORDER.map((name) => ({
    name,
    weight: SIGNAL_WEIGHTS[name],
    matched: matches[name],
  }));
}

function emptySignals(): readonly Signal[] {
  return SIGNAL_ORDER.map((name) => ({
    name,
    weight: SIGNAL_WEIGHTS[name],
    matched: false,
  }));
}

/**
 * Classify a fetched source tree. Pure with respect to `contentRoot` (no
 * external state, no network); the only side effect is `readdir`/`stat`.
 */
export async function classifySource(contentRoot: string): Promise<Classification> {
  if (await dirExists(join(contentRoot, '.agentsmesh'))) {
    return { type: 'canonical-agentsmesh', score: 0, signals: emptySignals() };
  }

  const ctx: SignalContext = { contentRoot };
  const matches: Record<SignalName, boolean> = {
    'skill-pack-layout': await hasSkillPackLayout(ctx),
    'agents-dir': await hasAgentsDir(ctx),
    'references-dir': await hasReferencesDir(ctx),
    'multi-tool-rules': await hasMultiToolRules(ctx),
    'per-target-commands': await hasPerTargetCommands(ctx),
  };
  const signals = buildSignals(matches);
  const score = signals.reduce((sum, s) => (s.matched ? sum + s.weight : sum), 0);

  let type: SourceType;
  if (matches['skill-pack-layout'] && score >= SKILL_PACK_THRESHOLD) {
    type = 'anthropic-skill-pack';
  } else if (await hasAnyToolNativeDir(contentRoot)) {
    type = 'tool-native';
  } else {
    type = 'unknown';
  }

  return { type, score, signals };
}
