// src/cli/prompts/prompter.ts
/**
 * Minimal prompt surface used by the init wizard. Abstracts @clack/prompts so
 * the wizard is unit-testable with a scripted fake (no TTY required) and the
 * concrete prompt library is a one-file swap.
 */

export interface MultiselectOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface ConfirmOptions {
  readonly message: string;
  readonly initialValue?: boolean;
}

export interface MultiselectOptions {
  readonly message: string;
  readonly options: readonly MultiselectOption[];
  readonly initialValues?: readonly string[];
  readonly required?: boolean;
}

export interface Prompter {
  intro(title: string): void;
  outro(message: string): void;
  note(message: string, title?: string): void;
  /** Resolves to the boolean answer, or a cancel symbol (detect via {@link Prompter.isCancel}). */
  confirm(options: ConfirmOptions): Promise<boolean | symbol>;
  /** Resolves to the selected values, or a cancel symbol. */
  multiselect(options: MultiselectOptions): Promise<string[] | symbol>;
  isCancel(value: unknown): boolean;
  cancel(message: string): void;
}
