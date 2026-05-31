import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { hashBullet } from './bullet-hash.js';
import { parseBullets } from './bullet-parser.js';
import { parseIndex } from './index-schema.js';
import { loadLedger, saveLedger } from './ledger.js';
import type { LessonsPaths } from './paths.js';
import { scoreBullet } from './scoring.js';

export interface ProposalEntry {
  readonly hash: string;
  readonly lineNumber: number;
  readonly bulletText: string;
  readonly proposed: ReadonlyArray<{ topic: string; score: number }>;
  readonly defaultDecision: string;
}

export interface ProposeDistillResult {
  readonly proposals: ProposalEntry[];
  readonly proposalFileWritten: string | null;
}

/**
 * Score every unrouted bullet against the index and write a proposal file the
 * user can edit. Returns the structured proposals so callers can render
 * machine-readable output (JSON, MCP, IDE plugin) in addition to writing the
 * markdown file.
 */
export function proposeDistill(paths: LessonsPaths): ProposeDistillResult {
  const index = parseIndex(parseYaml(readFileSync(paths.index, 'utf8')) as unknown);
  const bullets = parseBullets(readFileSync(paths.journal, 'utf8'));
  const ledger = loadLedger(paths.ledger);

  const proposals: ProposalEntry[] = [];
  for (const bullet of bullets) {
    const hash = hashBullet(bullet.text);
    if (ledger.assignments[hash] !== undefined) continue;
    const ranked = scoreBullet(bullet.text, index.clusters).slice(0, 2);
    proposals.push({
      hash,
      lineNumber: bullet.lineNumber,
      bulletText: bullet.text,
      proposed: ranked.map((r) => ({ topic: r.cluster.topic, score: r.score })),
      defaultDecision: ranked[0]?.cluster.topic ?? 'skip',
    });
  }

  if (proposals.length === 0) {
    if (existsSync(paths.proposal)) writeFileSync(paths.proposal, '');
    return { proposals, proposalFileWritten: null };
  }

  mkdirSync(dirname(paths.proposal), { recursive: true });
  writeFileSync(paths.proposal, renderProposalFile(proposals), 'utf8');
  return { proposals, proposalFileWritten: paths.proposal };
}

function renderProposalFile(proposals: readonly ProposalEntry[]): string {
  const lines: string[] = ['# Distill proposal', ''];
  for (const p of proposals) {
    const noMatch = p.proposed.length === 0;
    lines.push(`## L${p.lineNumber} (hash ${p.hash})${noMatch ? ' — NO MATCH' : ''}`, '');
    if (!noMatch) {
      lines.push(`proposed: ${p.proposed.map((r) => `${r.topic}(${r.score})`).join(', ')}`, '');
    }
    lines.push('```', p.bulletText, '```', '', `decision: ${p.defaultDecision}`, '');
  }
  return lines.join('\n');
}

export interface ApplyDistillResult {
  readonly routed: number;
  readonly skipped: number;
  readonly unknownTopics: string[];
}

/**
 * Apply the user-confirmed decisions from the proposal file: record each in
 * the ledger and clear the proposal. Throws when the proposal file is missing
 * or a decision references an unknown topic — callers translate to CLI exit
 * codes.
 */
export function applyDistill(paths: LessonsPaths): ApplyDistillResult {
  if (!existsSync(paths.proposal)) {
    throw new Error(`No proposal file at ${paths.proposal}. Run distill (without --apply) first.`);
  }
  const index = parseIndex(parseYaml(readFileSync(paths.index, 'utf8')) as unknown);
  const knownTopics = new Set(index.clusters.map((c) => c.topic));
  const proposal = readFileSync(paths.proposal, 'utf8');
  const ledger = loadLedger(paths.ledger);

  let routed = 0;
  let skipped = 0;
  const unknownTopics: string[] = [];

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
      unknownTopics.push(decision);
      continue;
    }
    ledger.assignments[hash] = decision;
    routed += 1;
  }

  if (unknownTopics.length > 0) {
    throw new Error(`Unknown topic(s) in decisions: ${unknownTopics.join(', ')}`);
  }

  saveLedger(paths.ledger, ledger);
  writeFileSync(paths.proposal, '', 'utf8');
  return { routed, skipped, unknownTopics };
}
