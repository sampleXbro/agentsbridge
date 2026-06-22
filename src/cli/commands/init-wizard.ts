// src/cli/commands/init-wizard.ts
/**
 * Interactive init wizard. Collects all answers first, then applies them via
 * applyInitPlan, then optionally runs generate. Cancelling at any prompt writes
 * nothing. Runs only in project scope (the handler gates on TTY/--yes/--global).
 */

import type { ScopeContext } from '../../config/core/scope.js';
import { BUILTIN_TARGET_IDS } from '../../targets/catalog/target-ids.js';
import { starterInitTargetIds } from '../../targets/catalog/init-starter-targets.js';
import { runGenerate } from './generate.js';
import {
  applyInitPlan,
  CONFIG_FILENAME,
  LOCAL_CONFIG_FILENAME,
  type InitCommandResult,
  type InitPlan,
} from './init-apply.js';
import type { MultiselectOption, Prompter } from '../prompts/prompter.js';

/** Build the multiselect option list: starter targets first, the rest alphabetical. */
export function buildTargetOptions(): { options: MultiselectOption[]; starter: string[] } {
  const starter = [...starterInitTargetIds()];
  const starterSet = new Set<string>(starter);
  const rest = [...BUILTIN_TARGET_IDS].filter((id) => !starterSet.has(id)).sort();
  const options: MultiselectOption[] = [...starter, ...rest].map((id) => ({
    value: id,
    label: id,
    hint: starterSet.has(id) ? 'starter' : undefined,
  }));
  return { options, starter };
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
  ctx: { projectRoot: string; context: ScopeContext; detected: readonly string[] },
): Promise<InitCommandResult> {
  prompter.intro('agentsmesh init');
  const bail = (): InitCommandResult => {
    prompter.cancel('Cancelled — no changes written.');
    return cancelledResult(ctx.context.scope);
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
  const { options, starter } = buildTargetOptions();
  const initialValues = doImport && ctx.detected.length > 0 ? [...ctx.detected] : starter;
  const targetsAns = await prompter.multiselect({
    message: 'Which tools should agentsmesh generate config for?',
    options,
    initialValues,
    required: true,
  });
  if (prompter.isCancel(targetsAns)) return bail();
  const targets = targetsAns as string[];

  // 3. Lessons
  const lessonsAns = await prompter.confirm({
    message: 'Enable Lessons (shared memory: recall before edits, capture after failures)?',
    initialValue: true,
  });
  if (prompter.isCancel(lessonsAns)) return bail();
  const lessons = lessonsAns === true;

  // 4. Generate now?
  const generateAns = await prompter.confirm({
    message: 'Run generate now to write tool config files?',
    initialValue: true,
  });
  if (prompter.isCancel(generateAns)) return bail();
  const doGenerate = generateAns === true;

  // 5. Apply (first disk writes happen here)
  const plan: InitPlan = {
    scope: 'project',
    targets,
    defaultTargets: undefined,
    detected: ctx.detected,
    doImport,
    lessons,
  };
  const data = await applyInitPlan(ctx.projectRoot, ctx.context, plan);

  // 6. Generate
  let generatedCount = 0;
  if (doGenerate) {
    const gen = await runGenerate({}, ctx.projectRoot, { printMatrix: false });
    generatedCount = gen.data.summary.created + gen.data.summary.updated;
  }

  // 7. Summary
  prompter.note(
    [
      `Targets: ${targets.length} (${targets.join(', ')})`,
      `Lessons: ${lessons ? 'enabled' : 'off'}`,
      doGenerate ? `Generated: ${generatedCount} file(s)` : `Next: run 'agentsmesh generate'`,
    ].join('\n'),
    'Setup complete',
  );
  prompter.outro("agentsmesh is ready. Edit .agentsmesh/ then run 'agentsmesh generate' to sync.");

  return { exitCode: 0, data };
}
