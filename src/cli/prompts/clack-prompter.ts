// src/cli/prompts/clack-prompter.ts
import * as clack from '@clack/prompts';
import type { Prompter } from './prompter.js';

/** Concrete {@link Prompter} backed by @clack/prompts (real TTY UI). */
export function createClackPrompter(): Prompter {
  return {
    intro: (title) => clack.intro(title),
    outro: (message) => clack.outro(message),
    note: (message, title) => clack.note(message, title),
    select: (options) =>
      clack.select({
        message: options.message,
        options: options.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
        initialValue: options.initialValue,
      }) as Promise<string | symbol>,
    multiselect: (options) =>
      clack.multiselect({
        message: options.message,
        options: options.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
        initialValues: options.initialValues ? [...options.initialValues] : undefined,
        required: options.required ?? false,
      }) as Promise<string[] | symbol>,
    isCancel: (value) => clack.isCancel(value),
    cancel: (message) => clack.cancel(message),
  };
}
