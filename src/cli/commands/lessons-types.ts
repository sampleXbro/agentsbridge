import type { ValidationFinding } from '../../lessons/validate.js';

export type LessonsQueryFormat = 'plain' | 'md' | 'json';

export interface LessonsQueryData {
  readonly lessons: Array<{
    readonly id: string;
    readonly rule: string;
    readonly topics: string[];
    readonly triggers: string[];
    readonly evidence: string[];
    readonly score?: number;
  }>;
  readonly query: { file?: string; command?: string; keyword?: string };
  readonly autoMigrated: boolean;
  /** Number of lessons that matched before ranking/cap — for truncation notices. */
  readonly totalMatches?: number;
}

export interface LessonsAddData {
  readonly id: string;
  readonly isNewLesson: boolean;
  readonly isNewTopic: boolean;
  readonly newTriggerIds: string[];
}

export interface LessonsTopicsData {
  readonly topics: Array<{ readonly id: string; readonly summary: string }>;
}

export interface LessonsShowData {
  readonly topic: string;
  readonly markdown: string;
}

export interface LessonsDeprecateData {
  readonly id: string;
  readonly supersededBy: string | null;
}

export interface LessonsMergeData {
  readonly loserId: string;
  readonly keeperId: string;
}

export interface LessonsStripMarkersData {
  readonly changedIds: string[];
  readonly changedCount: number;
  readonly dryRun: boolean;
}

export interface LessonsJournalData {
  readonly entries: Array<{
    readonly id: string;
    readonly rule: string;
    readonly createdAt: string;
    readonly topics: string[];
  }>;
}

export interface LessonsValidateData {
  readonly ok: boolean;
  readonly findings: ValidationFinding[];
}

export interface LessonsImportMdData {
  readonly topicCount: number;
  readonly lessonCount: number;
  readonly triggerCount: number;
  readonly wroteGraphPath: string;
  readonly deletedPaths: string[];
}

export type LessonsCommandResult =
  | { subcommand: 'help'; exitCode: number; error?: string; data: null }
  | {
      subcommand: 'query';
      exitCode: number;
      format: LessonsQueryFormat;
      data: LessonsQueryData;
      error?: string;
    }
  | { subcommand: 'add'; exitCode: number; data: LessonsAddData; error?: string }
  | { subcommand: 'topics'; exitCode: number; data: LessonsTopicsData; error?: string }
  | { subcommand: 'show'; exitCode: number; data: LessonsShowData; error?: string }
  | { subcommand: 'deprecate'; exitCode: number; data: LessonsDeprecateData; error?: string }
  | { subcommand: 'merge'; exitCode: number; data: LessonsMergeData; error?: string }
  | {
      subcommand: 'strip-markers';
      exitCode: number;
      data: LessonsStripMarkersData;
      error?: string;
    }
  | { subcommand: 'journal'; exitCode: number; data: LessonsJournalData; error?: string }
  | { subcommand: 'validate'; exitCode: number; data: LessonsValidateData; error?: string }
  | { subcommand: 'import-md'; exitCode: number; data: LessonsImportMdData; error?: string };
