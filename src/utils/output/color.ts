// Single source of truth for whether ANSI color should be emitted to a stream.
//
// Precedence (matches the supports-color / NO_COLOR conventions):
//   FORCE_COLOR > NO_COLOR > stream.isTTY
//
// Piped consumers (no TTY) get plain text by default, so agents reading the CLI
// over a pipe never see escape bytes. FORCE_COLOR lets a caller opt back in
// (e.g. `agentsmesh matrix | less -R`).

interface ColorStream {
  isTTY?: boolean;
}

function noColorRequested(): boolean {
  const value = process.env.NO_COLOR;
  return value !== undefined && value !== '';
}

/** `undefined` when FORCE_COLOR is unset, else the forced on/off decision. */
function forceColorRequested(): boolean | undefined {
  const value = process.env.FORCE_COLOR;
  if (value === undefined) return undefined;
  return value !== '0' && value !== 'false';
}

export function colorEnabled(stream: ColorStream = process.stdout): boolean {
  const forced = forceColorRequested();
  if (forced !== undefined) return forced;
  if (noColorRequested()) return false;
  return stream.isTTY === true;
}
