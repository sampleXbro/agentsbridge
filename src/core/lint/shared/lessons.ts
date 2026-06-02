/**
 * Lint guard for the `.agentsmesh/lessons/` subsystem.
 *
 * Validates only the contract the procedural rule depends on at recall time:
 * index parseability, topic-file presence, topic-body shape, regex validity,
 * and presence of the procedural rule paragraph in `_root.md`.
 *
 * Project-scope only — lessons live in the project tree, never under `~`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { LessonsIndexSchema } from '../../../lessons/index-schema.js';
import { lessonsPaths } from '../../../lessons/paths.js';
import type { TargetLayoutScope } from '../../../targets/catalog/target-descriptor.js';
import type { LintDiagnostic } from '../../types.js';

const LESSONS_TARGET = 'lessons';
const INDEX_REL = '.agentsmesh/lessons/index.yaml';
const ROOT_RULE_REL = '.agentsmesh/rules/_root.md';
const LESSONS_HEADING = /^## Lessons \(/m;
const RULES_HEADING = /^## Rules\b/m;

export function lintLessonsSubsystem(
  projectRoot: string,
  scope: TargetLayoutScope,
): LintDiagnostic[] {
  if (scope === 'global') return [];
  const paths = lessonsPaths(projectRoot);
  if (!existsSync(paths.index)) return [];

  const out: LintDiagnostic[] = [];
  const parsed = LessonsIndexSchema.safeParse(parseYaml(readFileSync(paths.index, 'utf8')));
  if (!parsed.success) {
    return [diag('error', INDEX_REL, `index.yaml is invalid: ${parsed.error.issues[0]!.message}`)];
  }

  for (const cluster of parsed.data.clusters) {
    const topicAbs = join(projectRoot, cluster.file);
    if (!existsSync(topicAbs)) {
      out.push(
        diag('error', cluster.file, `topic file for cluster "${cluster.topic}" does not exist.`),
      );
      continue;
    }
    if (!RULES_HEADING.test(readFileSync(topicAbs, 'utf8'))) {
      out.push(
        diag('warning', cluster.file, `topic "${cluster.topic}" is missing a "## Rules" section.`),
      );
    }
    for (const pattern of cluster.triggers.command_patterns) {
      try {
        new RegExp(pattern);
      } catch {
        out.push(
          diag(
            'warning',
            INDEX_REL,
            `cluster "${cluster.topic}" command_patterns entry is not a valid regex: ${pattern}`,
          ),
        );
      }
    }
  }

  const rootRuleAbs = join(projectRoot, ROOT_RULE_REL);
  const rootRuleBody = existsSync(rootRuleAbs) ? readFileSync(rootRuleAbs, 'utf8') : '';
  if (!LESSONS_HEADING.test(rootRuleBody)) {
    out.push(
      diag(
        'warning',
        ROOT_RULE_REL,
        'lessons procedural rule ("## Lessons (...)") is missing from _root.md — recall/capture enforcement will not fire.',
      ),
    );
  }

  return out;
}

function diag(level: 'error' | 'warning', file: string, message: string): LintDiagnostic {
  return { level, file, target: LESSONS_TARGET, message };
}
