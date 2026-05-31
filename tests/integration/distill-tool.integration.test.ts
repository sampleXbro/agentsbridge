import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashBullet } from '../../src/lessons/bullet-hash.js';
import { loadLedger, saveLedger } from '../../src/lessons/ledger.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const DISTILL_SCRIPT = join(REPO, 'scripts/distill-lessons.ts');
const TSX = join(REPO, 'node_modules/.bin/tsx');
const BULLET =
  '- **Shell quoting failed**: rg parsed the search text as a flag. The pattern started with a dash. Pass dash-leading patterns with -e.';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'distill-lessons-'));
  const paths = lessonsPaths(projectRoot);
  mkdirSync(paths.topicsDir, { recursive: true });
  writeFileSync(paths.journal, `# Lessons Learned\n\n${BULLET}\n`, 'utf8');
  writeFileSync(
    paths.index,
    `version: 1
clusters:
  - topic: shell-quoting
    file: .agentsmesh/lessons/topics/shell-quoting.md
    summary: Shell quoting rules.
    triggers:
      file_globs: []
      command_patterns: []
      keywords:
        - shell
        - rg
`,
    'utf8',
  );
});

function runDistill(...args: string[]): string {
  return execFileSync(TSX, [DISTILL_SCRIPT, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

describe('distill tool', () => {
  it('produces no proposal when the temp journal is already assigned in the ledger', () => {
    const paths = lessonsPaths(projectRoot);
    saveLedger(paths.ledger, {
      version: 1,
      assignments: { [hashBullet(BULLET)]: 'shell-quoting' },
    });

    expect(runDistill()).toContain('No new bullets to distill.');
    const empty =
      existsSync(paths.proposal) === false ||
      readFileSync(paths.proposal, 'utf8').trim().length === 0;
    expect(empty).toBe(true);
  });

  it('proposes and applies one exact routing decision for a new temp journal bullet', () => {
    const paths = lessonsPaths(projectRoot);
    const hash = hashBullet(BULLET);

    const output = runDistill();
    expect(output).toContain('Wrote 1 proposals to ');
    expect(output).toContain('distill-proposal.md');
    expect(readFileSync(paths.proposal, 'utf8')).toBe(`# Distill proposal

## L3 (hash ${hash})

proposed: shell-quoting(4)

\`\`\`
${BULLET}
\`\`\`

decision: shell-quoting
`);

    expect(runDistill('--apply')).toContain('Applied. 1 bullet(s) routed, 0 skipped.');
    expect(loadLedger(paths.ledger).assignments).toEqual({ [hash]: 'shell-quoting' });
    expect(readFileSync(paths.proposal, 'utf8')).toBe('');
  });
});
