import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseBullets } from '../src/lessons/bullet-parser.js';
import { hashBullet } from '../src/lessons/bullet-hash.js';
import { loadLedger, saveLedger } from '../src/lessons/ledger.js';
import { scoreBullet } from '../src/lessons/scoring.js';
import { lessonsPaths } from '../src/lessons/paths.js';
import { loadLessonsIndex } from '../src/lessons/store.js';

const paths = lessonsPaths(process.cwd());

function propose(): void {
  const index = loadLessonsIndex(process.cwd());
  const bullets = parseBullets(readFileSync(paths.journal, 'utf8'));
  const ledger = loadLedger(paths.ledger);

  const lines: string[] = ['# Distill proposal', ''];
  let count = 0;
  for (const b of bullets) {
    const h = hashBullet(b.text);
    if (ledger.assignments[h] !== undefined) continue;
    const ranked = scoreBullet(b.text, index.clusters).slice(0, 2);
    if (ranked.length === 0) {
      lines.push(
        `## L${b.lineNumber} (hash ${h}) — NO MATCH`,
        '',
        '```',
        b.text,
        '```',
        '',
        'decision: skip',
        '',
      );
    } else {
      lines.push(
        `## L${b.lineNumber} (hash ${h})`,
        '',
        `proposed: ${ranked.map((r) => `${r.cluster.topic}(${r.score})`).join(', ')}`,
        '',
        '```',
        b.text,
        '```',
        '',
        `decision: ${ranked[0]?.cluster.topic ?? 'skip'}`,
        '',
      );
    }
    count += 1;
  }

  if (count === 0) {
    if (existsSync(paths.proposal)) writeFileSync(paths.proposal, '');
    console.log('No new bullets to distill.');
    return;
  }
  mkdirSync(dirname(paths.proposal), { recursive: true });
  writeFileSync(paths.proposal, lines.join('\n'), 'utf8');
  console.log(`Wrote ${count} proposals to ${paths.proposal}.`);
}

function apply(): void {
  if (!existsSync(paths.proposal)) {
    console.error('No proposal file. Run without --apply first.');
    process.exit(1);
  }
  const index = loadLessonsIndex(process.cwd());
  const knownTopics = new Set(index.clusters.map((c) => c.topic));
  const proposal = readFileSync(paths.proposal, 'utf8');
  const ledger = loadLedger(paths.ledger);

  let routed = 0;
  let skipped = 0;
  const blocks = proposal.split(/^## /m).slice(1);
  for (const block of blocks) {
    const hashMatch = block.match(/\(hash ([a-f0-9]+)\)/);
    const decisionMatch = block.match(/^decision:\s*(\S+)/m);
    if (hashMatch === null || decisionMatch === null) continue;
    const hash = hashMatch[1] ?? '';
    const decision = decisionMatch[1] ?? '';
    if (hash.length === 0) continue;
    if (decision === 'skip') {
      ledger.assignments[hash] = 'skip';
      skipped += 1;
      continue;
    }
    if (!knownTopics.has(decision)) {
      console.error(`Unknown topic in decision: ${decision}`);
      process.exit(1);
    }
    ledger.assignments[hash] = decision;
    routed += 1;
  }
  saveLedger(paths.ledger, ledger);
  writeFileSync(paths.proposal, '', 'utf8');
  console.log(
    `Applied. ${routed} bullet(s) routed, ${skipped} skipped. Ledger updated. ` +
      `Topic Rules sections are author-maintained — edit them manually if a new bullet teaches a new rule.`,
  );
}

const mode = process.argv[2] ?? '--propose';
if (mode === '--apply') apply();
else propose();
