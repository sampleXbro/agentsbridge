import { ui } from '../ui/ui.js';
import type { ConvertCommandResult } from '../commands/convert.js';

export function renderConvert(result: ConvertCommandResult): void {
  const { data } = result;

  if (data.files.length === 0) {
    ui.info(`No files found to convert from ${data.from}.`);
    return;
  }

  if (data.mode === 'dry-run') {
    for (const f of data.files) {
      ui.info(`[dry-run] ${f.status} ${f.path} (${f.target})`);
    }
    return;
  }

  for (const f of data.files) {
    if (f.status === 'created' || f.status === 'updated') {
      ui.success(`${f.status} ${f.path}`);
    }
  }

  const { created, updated, unchanged } = data.summary;
  if (created > 0 || updated > 0) {
    ui.info(
      `Converted from ${data.from} → ${data.to}: ${created} created, ${updated} updated, ${unchanged} unchanged`,
    );
  } else {
    ui.info(`Nothing changed. (${unchanged} unchanged)`);
  }
}
