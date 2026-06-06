/**
 * MERGE-recovery for the legacy migrator: fold legacy lesson specs into an
 * existing graph through the normal capture path (rule-text dedup,
 * content-addressed trigger dedup, topic union), then remove the legacy
 * artifacts. Never overwrites graph data, so it safely recovers a stranded
 * legacy store coexisting with a populated `lessons.json`.
 */

import { addLessonInto, type AddLessonInput } from './add.js';
import { deleteLegacyArtifacts } from './import-legacy-parse.js';
import type { ImportLegacyOptions, ImportLegacyReport } from './import-legacy.js';
import { mutateLessonsGraphLocked } from './mutate.js';
import type { LessonsPaths } from './paths.js';

export async function mergeLegacy(
  projectRoot: string,
  paths: LessonsPaths,
  specs: AddLessonInput[],
  summaryByTopic: Map<string, string>,
  options: ImportLegacyOptions,
): Promise<ImportLegacyReport> {
  let addedLessons = 0;
  const addedTriggers = new Set<string>();
  const touchedTopics = new Set<string>();
  await mutateLessonsGraphLocked(projectRoot, (g) => {
    addedLessons = 0;
    addedTriggers.clear();
    touchedTopics.clear();
    for (const spec of specs) {
      const result = addLessonInto(g, spec, {
        allowNewTopic: true,
        topicSummary: summaryByTopic.get(spec.topic),
      });
      if (result.isNewLesson) addedLessons += 1;
      for (const t of result.newTriggerIds) addedTriggers.add(t);
      touchedTopics.add(spec.topic);
    }
  });

  const deletedPaths = options.deleteLegacy === false ? [] : deleteLegacyArtifacts(paths.base);

  return {
    wroteGraphPath: paths.graph,
    deletedPaths,
    topicCount: touchedTopics.size,
    lessonCount: addedLessons,
    triggerCount: addedTriggers.size,
  };
}
