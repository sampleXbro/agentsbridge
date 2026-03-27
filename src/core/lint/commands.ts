import type { CanonicalFiles, LintDiagnostic } from '../types.js';

export function lintCommands(canonical: CanonicalFiles, target: string): LintDiagnostic[] {
  if (canonical.commands.length === 0) return [];
  return canonical.commands.flatMap((command) => {
    if (target === 'copilot' && command.allowedTools.length > 0) {
      return [
        {
          level: 'warning' as const,
          file: command.source,
          target,
          message: 'Copilot prompt files do not enforce canonical allowed-tools natively.',
        },
      ];
    }

    if (
      target === 'cursor' &&
      (command.description.length > 0 || command.allowedTools.length > 0)
    ) {
      return [
        {
          level: 'warning' as const,
          file: command.source,
          target,
          message:
            'Cursor command files are plain Markdown; command description and allowed-tools metadata are not projected.',
        },
      ];
    }

    if (target === 'gemini-cli' && command.allowedTools.length > 0) {
      return [
        {
          level: 'warning' as const,
          file: command.source,
          target,
          message: 'Gemini TOML command files do not project canonical allowed-tools metadata.',
        },
      ];
    }

    if (target === 'continue' && command.allowedTools.length > 0) {
      return [
        {
          level: 'warning' as const,
          file: command.source,
          target,
          message:
            'Continue invokable prompt rules do not natively enforce canonical allowed-tools metadata.',
        },
      ];
    }

    if (
      ['cline', 'windsurf'].includes(target) &&
      (command.description.length > 0 || command.allowedTools.length > 0)
    ) {
      return [
        {
          level: 'warning' as const,
          file: command.source,
          target,
          message: `${target} workflow files are plain Markdown; command description and allowed-tools metadata are not projected.`,
        },
      ];
    }

    return [];
  });
}
