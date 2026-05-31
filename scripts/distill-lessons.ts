import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseIndex } from '../src/lessons/index-schema.js';
import { parseBullets } from '../src/lessons/bullet-parser.js';
import { hashBullet } from '../src/lessons/bullet-hash.js';
import { loadLedger, saveLedger } from '../src/lessons/ledger.js';
import { scoreBullet } from '../src/lessons/scoring.js';
import { checkJournalCoverage } from '../src/lessons/check.js';
import { lessonsPaths } from '../src/lessons/paths.js';

const paths = lessonsPaths(process.cwd());

function propose(): void {
  const index = parseIndex(parseYaml(readFileSync(paths.index, 'utf8')) as unknown);
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
  const index = parseIndex(parseYaml(readFileSync(paths.index, 'utf8')) as unknown);
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

function check(): void {
  const result = checkJournalCoverage(paths);
  if (result.ok) {
    console.log(`✓ all ${result.checked} journal bullets routed`);
    return;
  }
  const journalRel = relative(process.cwd(), paths.journal).replaceAll('\\', '/');
  console.error(`✗ ${result.unrouted.length} unrouted bullet(s) in ${journalRel}:`);
  for (const bullet of result.unrouted) {
    console.error(`  L${bullet.lineNumber}  ${bullet.preview}`);
  }
  console.error('');
  console.error('Run `pnpm distill` → review proposal → `pnpm distill:apply`.');
  process.exit(1);
}

const mode = process.argv[2] ?? '--propose';
if (mode === '--apply') apply();
else if (mode === '--check') check();
else propose();
