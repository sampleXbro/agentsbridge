import * as clack from '@clack/prompts';
import { logger } from '../../utils/output/logger.js';
import { colorEnabled } from '../../utils/output/color.js';

export interface Ui {
  intro(title: string): void;
  outro(message: string): void;
  note(body: string, title?: string): void;
  spinner(): { start(msg?: string): void; stop(msg?: string): void; message(msg: string): void };
  success(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  info(msg: string): void;
  step(msg: string): void;
}

const NOOP_SPINNER = { start(): void {}, stop(): void {}, message(): void {} };

/** Presentation facade. On a TTY uses @clack/prompts; off-TTY delegates status
 *  lines to the existing logger and no-ops the decorative bits so piped/CI/test
 *  output remains byte-identical to what it was before. */
export function createUi(opts?: { isTTY?: boolean }): Ui {
  const tty = opts?.isTTY ?? colorEnabled(process.stdout);
  if (!tty) {
    return {
      intro: () => {},
      outro: () => {},
      note: () => {},
      spinner: () => NOOP_SPINNER,
      success: (m) => logger.success(m),
      error: (m) => logger.error(m),
      warn: (m) => logger.warn(m),
      info: (m) => logger.info(m),
      step: (m) => logger.info(m),
    };
  }
  return {
    intro: (t) => clack.intro(t),
    outro: (m) => clack.outro(m),
    note: (b, t) => clack.note(b, t),
    spinner: () => clack.spinner(),
    success: (m) => clack.log.success(m),
    error: (m) => clack.log.error(m),
    warn: (m) => clack.log.warn(m),
    info: (m) => clack.log.info(m),
    step: (m) => clack.log.step(m),
  };
}

/** Process-wide default facade (TTY auto-detected). */
export const ui: Ui = createUi();
