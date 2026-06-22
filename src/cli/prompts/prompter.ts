// src/cli/prompts/prompter.ts
/**
 * Minimal prompt surface used by the init wizard. Abstracts @clack/prompts so
 * the wizard is unit-testable with a scripted fake (no TTY required) and the
 * concrete prompt library is a one-file swap.
 *
 * Yes/no questions go through `select` (not a binary confirm) so a "↩ Back"
 * choice can be offered for step-back navigation.
 */

export interface MultiselectOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface MultiselectOptions {
  readonly message: string;
  readonly options: readonly MultiselectOption[];
  readonly initialValues?: readonly string[];
  readonly required?: boolean;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface SelectOptions {
  readonly message: string;
  readonly options: readonly SelectOption[];
  readonly initialValue?: string;
}

export interface Prompter {
  intro(title: string): void;
  outro(message: string): void;
  note(message: string, title?: string): void;
  /** Single-choice prompt; resolves to the chosen option value, or a cancel symbol. */
  select(options: SelectOptions): Promise<string | symbol>;
  /** Multi-choice prompt; resolves to the selected values, or a cancel symbol. */
  multiselect(options: MultiselectOptions): Promise<string[] | symbol>;
  isCancel(value: unknown): boolean;
  cancel(message: string): void;
}
