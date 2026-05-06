// Colored console output

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

function out(text: string): void {
  if (stdoutRedirectedToStderr) {
    process.stderr.write(text);
  } else {
    process.stdout.write(text);
  }
}

function noColor(): boolean {
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
}

function c(code: string, text: string): string {
  return noColor() ? text : `${code}${text}${C.reset}`;
}

function pad(str: string, width: number): string {
  const len = [...str].length; // grapheme-aware for unicode
  return str + ' '.repeat(Math.max(0, width - len));
}

export const logger = {
  info(msg: string): void {
    if (muted) return;
    out(c(C.cyan, msg) + '\n');
  },
  warn(msg: string): void {
    if (muted) return;
    process.stderr.write(c(C.yellow, '⚠ ') + msg + '\n');
  },
  error(msg: string): void {
    if (muted) return;
    process.stderr.write(c(C.red, '✗ ') + msg + '\n');
  },
  success(msg: string): void {
    if (muted) return;
    out(c(C.green, '✓ ') + msg + '\n');
  },
  debug(msg: string): void {
    if (muted) return;
    if (process.env.AGENTSMESH_DEBUG === '1') {
      out(c(C.cyan, '[debug] ') + msg + '\n');
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
