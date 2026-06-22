// src/cli/commands/init-wizard.ts
/**
 * Interactive init wizard. Collects all answers first, then applies them via
 * applyInitPlan, then optionally runs generate. Cancelling at any prompt writes
 * nothing. Scope-aware: in global scope the target list is restricted to
 * global-capable targets and the Lessons step is skipped entirely (lessons is
 * project-only).
 */

import type { ConfigScope, ScopeContext } from '../../config/core/scope.js';
import { BUILTIN_TARGET_IDS } from '../../targets/catalog/target-ids.js';
import {
  starterInitTargetIds,
  globalInitTargetIds,
} from '../../targets/catalog/init-starter-targets.js';
import { runGenerate } from './generate.js';
import {
  applyInitPlan,
  CONFIG_FILENAME,
  LOCAL_CONFIG_FILENAME,
  type InitCommandResult,
  type InitPlan,
} from './init-apply.js';
import type { MultiselectOption, Prompter } from '../prompts/prompter.js';

/**
 * Selectable targets + the pre-checked set for the given scope.
 * - project: every builtin target, starter set first then alphabetical, starter pre-checked.
 * - global: only global-capable targets (alphabetical), all pre-checked.
 */
export function buildTargetOptions(scope: ConfigScope): {
  options: MultiselectOption[];
  initialValues: string[];
} {
  if (scope === 'global') {
    const ids = [...globalInitTargetIds()].sort();
    const options: MultiselectOption[] = ids.map((id) => ({
      value: id,
      label: id,
      hint: 'global',
    }));
    return { options, initialValues: ids };
  }

  const starter = [...starterInitTargetIds()];
  const starterSet = new Set<string>(starter);
  const rest = [...BUILTIN_TARGET_IDS].filter((id) => !starterSet.has(id)).sort();
  const options: MultiselectOption[] = [...starter, ...rest].map((id) => ({
    value: id,
    label: id,
    hint: starterSet.has(id) ? 'starter' : undefined,
  }));
  return { options, initialValues: starter };
}

function cancelledResult(scope: ScopeContext['scope']): InitCommandResult {
  return {
    exitCode: 0,
    data: {
      scope,
      configFile: CONFIG_FILENAME,
      localConfigFile: LOCAL_CONFIG_FILENAME,
      detectedConfigs: [],
      imported: [],
      importedToolCount: 0,
      scaffoldType: 'none',
      gitignoreUpdated: false,
      cancelled: true,
    },
  };
}

export async function runInitWizard(
  prompter: Prompter,
  ctx: {
    projectRoot: string;
    context: ScopeContext;
    detected: readonly string[];
    defaultTargets: readonly string[] | undefined;
  },
): Promise<InitCommandResult> {
  const scope = ctx.context.scope;
  prompter.intro(scope === 'global' ? 'agentsmesh init --global' : 'agentsmesh init');
  const bail = (): InitCommandResult => {
    prompter.cancel('Cancelled — no changes written.');
    return cancelledResult(scope);
  };

  // 1. Import detected configs?
  let doImport = false;
  if (ctx.detected.length > 0) {
    const ans = await prompter.confirm({
      message: `Found existing config for: ${ctx.detected.join(', ')}. Import into .agentsmesh?`,
      initialValue: true,
    });
    if (prompter.isCancel(ans)) return bail();
    doImport = ans === true;
  }

  // 2. Targets
  const { options, initialValues } = buildTargetOptions(scope);
  const initial = doImport && ctx.detected.length > 0 ? [...ctx.detected] : initialValues;
  const targetsAns = await prompter.multiselect({
    message: 'Which tools should agentsmesh generate config for?',
    options,
    initialValues: initial,
    required: true,
  });
  if (prompter.isCancel(targetsAns)) return bail();
  const targets = targetsAns as string[];

  // 3. Lessons — project scope only (lessons is never available in global mode).
  let lessons = false;
  if (scope === 'project') {
    const lessonsAns = await prompter.confirm({
      message: 'Enable Lessons (shared memory: recall before edits, capture after failures)?',
      initialValue: true,
    });
    if (prompter.isCancel(lessonsAns)) return bail();
    lessons = lessonsAns === true;
  }

  // 4. Generate now?
  const generateAns = await prompter.confirm({
    message: 'Run generate now to write tool config files?',
    initialValue: true,
  });
  if (prompter.isCancel(generateAns)) return bail();
  const doGenerate = generateAns === true;

  // 5. Apply (first disk writes happen here)
  const plan: InitPlan = {
    scope,
    targets,
    defaultTargets: ctx.defaultTargets,
    detected: ctx.detected,
    doImport,
    lessons,
  };
  const data = await applyInitPlan(ctx.projectRoot, ctx.context, plan);

  // 6. Generate
  let generatedCount = 0;
  if (doGenerate) {
    const gen = await runGenerate(scope === 'global' ? { global: true } : {}, ctx.projectRoot, {
      printMatrix: false,
    });
    generatedCount = gen.data.summary.created + gen.data.summary.updated;
  }

  // 7. Summary
  const generateCmd = scope === 'global' ? 'agentsmesh generate --global' : 'agentsmesh generate';
  const summary = [`Targets: ${targets.length} (${targets.join(', ')})`];
  if (scope === 'project') {
    summary.push(
      lessons ? 'Lessons: enabled' : "Lessons: off — add it later with 'agentsmesh init --lessons'",
    );
  }
  summary.push(doGenerate ? `Generated: ${generatedCount} file(s)` : `Next: run '${generateCmd}'`);
  prompter.note(summary.join('\n'), 'Setup complete');
  prompter.outro(`agentsmesh is ready. Edit .agentsmesh/ then run '${generateCmd}' to sync.`);

  return { exitCode: 0, data };
}
