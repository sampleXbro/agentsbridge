// Colored console output

import { colorEnabled } from './color.js';

const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

let muted = false;
let stdoutRedirectedToStderr = false;

export function muteLogger(): void {
  muted = true;
}

export function unmuteLogger(): void {
  muted = false;
}

export function redirectLoggerToStderr(): void {
  stdoutRedirectedToStderr = true;
}

function outStream(): NodeJS.WriteStream {
  return stdoutRedirectedToStderr ? process.stderr : process.stdout;
}

function out(text: string): void {
  outStream().write(text);
}

function c(code: string, text: string, stream: NodeJS.WriteStream): string {
  return colorEnabled(stream) ? `${code}${text}${C.reset}` : text;
}

function pad(str: string, width: number): string {
  const len = [...str].length; // grapheme-aware for unicode
  return str + ' '.repeat(Math.max(0, width - len));
}

export const logger = {
  info(msg: string): void {
    if (muted) return;
    out(c(C.cyan, msg, outStream()) + '\n');
  },
  warn(msg: string): void {
    if (muted) return;
    process.stderr.write(c(C.yellow, '⚠ ', process.stderr) + msg + '\n');
  },
  error(msg: string): void {
    if (muted) return;
    process.stderr.write(c(C.red, '✗ ', process.stderr) + msg + '\n');
  },
  success(msg: string): void {
    if (muted) return;
    out(c(C.green, '✓ ', outStream()) + msg + '\n');
  },
  debug(msg: string): void {
    if (muted) return;
    if (process.env.AGENTSMESH_DEBUG === '1') {
      out(c(C.cyan, '[debug] ', outStream()) + msg + '\n');
    }
  },
  table(rows: string[][]): void {
    if (muted) return;
    if (rows.length === 0) return;
    const cols = rows[0]!.length;
    const widths: number[] = [];
    for (let j = 0; j < cols; j++) {
      let max = 0;
      for (let i = 0; i < rows.length; i++) {
        const len = [...rows[i]![j]!].length;
        if (len > max) max = len;
      }
      widths[j] = max;
    }
    const border = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
    out(border + '\n');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const line = '| ' + row.map((cell, j) => pad(cell, widths[j]!)).join(' | ') + ' |';
      out(line + '\n');
    }
    out(border + '\n');
  },
};
