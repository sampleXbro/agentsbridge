import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import { z } from 'zod';

const LedgerSchema = z.object({
  version: z.literal(1),
  assignments: z.record(z.string(), z.string()),
});

export type Ledger = z.infer<typeof LedgerSchema>;

export function loadLedger(path: string): Ledger {
  if (!existsSync(path)) return { version: 1, assignments: {} };
  return LedgerSchema.parse(parseYaml(readFileSync(path, 'utf8')));
}

export function saveLedger(path: string, ledger: Ledger): void {
  writeFileSync(path, yamlStringify(ledger), 'utf8');
}
