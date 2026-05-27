/**
 * agentsmesh refresh orchestration.
 *
 * Acquires the install lock, plans every targeted pack, prompts for consent
 * when drift is present, applies the refresh per pack (atomicity owned by
 * materializePack), then runs post-op generate once if any pack changed.
 */

import { join } from 'node:path';
import { loadScopedConfig } from '../../config/core/scope.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { acquireInstallLock } from '../lock/install-lock.js';
import { readInstallManifest } from '../core/install-manifest.js';
import { runPostOperationGenerate } from '../run/post-install-generate.js';
import { logger } from '../../utils/output/logger.js';
import { readRefreshFlags, parseRefreshNames } from './refresh-flags.js';
import { createDefaultResolveRef, planSinglePack, type RefreshPlan } from './refresh-plan.js';
import { applySinglePack } from './refresh-apply.js';
import { runConsentPrompt } from './refresh-prompt.js';
import { createRunInstallForRefresh } from './refresh-install-bridge.js';
import type { RefreshCommandResult } from './refresh-result.js';
import type { RefreshData } from '../../cli/command-result.js';

const PROMPT_TIMEOUT_MS = 5 * 60 * 1000;

export async function runRefresh(
  flags: Record<string, string | boolean>,
  args: readonly string[],
  projectRoot: string,
): Promise<RefreshCommandResult> {
  const { dryRun, force, global, json } = readRefreshFlags(flags);
  const scope: 'project' | 'global' = global ? 'global' : 'project';
  const names = parseRefreshNames(args);

  const emptyData = (): RefreshData => ({
    scope,
    mode: 'refresh',
    refreshed: [],
    unchanged: [],
    skipped: [],
    failed: [],
    dryRun,
  });

  const { config, context } = await loadScopedConfig(projectRoot, scope);
  await bootstrapPlugins(config, projectRoot);
  const lockRelease = await acquireInstallLock(context.canonicalDir);

  try {
    const manifest = await readInstallManifest(context.canonicalDir);

    // Validate names
    if (names.length > 0) {
      const known = new Set(manifest.map((e) => e.name));
      const unknown = names.filter((n) => !known.has(n));
      if (unknown.length > 0) {
        if (!json) logger.error(`Unknown pack(s): ${unknown.join(', ')}`);
        return { exitCode: 2, data: emptyData() };
      }
    }

    const targets = names.length > 0 ? manifest.filter((e) => names.includes(e.name)) : manifest;

    if (targets.length === 0) {
      if (!json) logger.info('No packs to refresh.');
      return { exitCode: 0, data: emptyData() };
    }

    // Plan phase
    const packsDir = join(context.canonicalDir, 'packs');
    const resolveRef = createDefaultResolveRef();
    const plans: RefreshPlan[] = [];
    for (const entry of targets) {
      plans.push(await planSinglePack(entry, packsDir, { resolveRef }));
    }

    // Sort plans into buckets
    const errors = plans.filter((p) => p.classification === 'error');
    const unchanged = plans.filter((p) => p.classification === 'unchanged');
    const cleanUpdate = plans.filter((p) => p.classification === 'clean-update');
    const needsConsent = plans.filter((p) => p.classification === 'needs-consent');

    const data = emptyData();
    data.unchanged = unchanged.map((p) => ({ name: p.name, ref: p.newSha }));
    data.failed = errors.map((p) => ({
      name: p.name,
      phase: 'plan' as const,
      error: p.error?.message ?? 'unknown plan error',
    }));

    // Dry-run: stop here, but populate refreshed[] so output faithfully previews
    // what the real run will produce. Use empty changedFiles since we haven't
    // fetched new content yet.
    if (dryRun) {
      for (const plan of cleanUpdate) {
        data.refreshed.push({
          name: plan.name,
          oldRef: plan.oldSha,
          newRef: plan.newSha,
          oldSha: plan.oldSha,
          newSha: plan.newSha,
          changedFiles: { added: [], removed: [], modified: [] },
        });
      }
      // needsConsent packs are also surfaced: with --force they'd refresh;
      // without, they'd prompt. Dry-run assumes the user will proceed.
      for (const plan of needsConsent) {
        data.refreshed.push({
          name: plan.name,
          oldRef: plan.oldSha,
          newRef: plan.newSha,
          oldSha: plan.oldSha,
          newSha: plan.newSha,
          changedFiles: { added: [], removed: [], modified: [] },
        });
      }
      return { exitCode: errors.length > 0 ? 1 : 0, data };
    }

    // Consent for needs-consent
    const proceedSet = new Set(cleanUpdate.map((p) => p.name));
    if (needsConsent.length > 0) {
      if (force) {
        for (const p of needsConsent) proceedSet.add(p.name);
      } else {
        const consent = await runConsentPrompt(
          needsConsent.map((p) => ({ name: p.name, modifiedCount: p.modifications.length })),
          { timeoutMs: PROMPT_TIMEOUT_MS },
        );
        if (consent.proceed && !consent.perPack) {
          for (const p of needsConsent) proceedSet.add(p.name);
        } else if (consent.proceed && consent.perPack) {
          // Per-pack: prompt individually
          for (const p of needsConsent) {
            const per = await runConsentPrompt(
              [{ name: p.name, modifiedCount: p.modifications.length }],
              { timeoutMs: PROMPT_TIMEOUT_MS },
            );
            if (per.proceed) proceedSet.add(p.name);
            else data.skipped.push({ name: p.name, reason: 'user-declined' });
          }
        } else {
          // Declined or timed out
          for (const name of consent.declined) {
            data.skipped.push({ name, reason: 'user-declined' });
          }
        }
      }
    }

    // Apply phase
    const runInstallForRefresh = createRunInstallForRefresh({ projectRoot, scope });
    for (const plan of [...cleanUpdate, ...needsConsent]) {
      if (!proceedSet.has(plan.name)) continue;
      const result = await applySinglePack(plan, context.canonicalDir, { runInstallForRefresh });
      if (result.success) {
        data.refreshed.push({
          name: plan.name,
          oldRef: plan.oldSha,
          newRef: plan.newSha,
          oldSha: plan.oldSha,
          newSha: plan.newSha,
          changedFiles: { added: [], removed: [], modified: [] },
        });
      } else {
        data.failed.push({
          name: plan.name,
          phase: result.phase ?? 'apply',
          error: result.error ?? 'unknown',
        });
      }
    }

    // Post-op generate
    if (data.refreshed.length > 0) {
      await runPostOperationGenerate('refresh', scope, context.rootBase);
    }

    const exitCode = data.failed.length > 0 ? 1 : 0;
    return { exitCode, data };
  } finally {
    await lockRelease();
  }
}
