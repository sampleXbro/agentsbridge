/**
 * Coarse error-class signature for the recurrence-driven capture nudge (STORE).
 *
 * A raw tool error is volatile — paths, line/column numbers, and hex addresses
 * differ run to run — so we reduce it to a stable-ish CLASS: the first non-empty
 * line, lowercased, with those volatile spans collapsed to a placeholder and the
 * length capped. Deliberately coarse: an honest weak signature surfaced to remind
 * the author WHAT recurred so they write a precise rule — never an identity key.
 */

const MAX_ERROR_CLASS = 120;

export function errorClass(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (firstLine === undefined) return undefined;
  const normalized = firstLine
    .toLowerCase()
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '…') // quoted paths / values (balanced delimiters)
    .replace(/0x[0-9a-f]+/g, '…') // hex addresses
    .replace(/\d+/g, '…') // line/col numbers, counts
    .replace(/…+/g, '…') // collapse adjacent placeholders
    .replace(/\s+/g, ' ')
    .trim();
  const out = normalized.length > 0 ? normalized : firstLine.toLowerCase().trim();
  return out.slice(0, MAX_ERROR_CLASS);
}
