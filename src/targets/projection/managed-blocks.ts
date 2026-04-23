import { basename, join } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';

export const ROOT_CONTRACT_START = '<!-- agentsmesh:root-generation-contract:start -->';
export const ROOT_CONTRACT_END = '<!-- agentsmesh:root-generation-contract:end -->';
export const EMBEDDED_RULES_START = '<!-- agentsmesh:embedded-rules:start -->';
export const EMBEDDED_RULES_END = '<!-- agentsmesh:embedded-rules:end -->';
export const EMBEDDED_RULE_END = '<!-- agentsmesh:embedded-rule:end -->';

const EMBEDDED_RULE_START_PREFIX = '<!-- agentsmesh:embedded-rule:start ';
const EMBEDDED_RULE_START_SUFFIX = ' -->';

interface EmbeddedRuleMarker {
  source: string;
  description: string;
  globs: string[];
  targets: string[];
}

export interface ExtractedEmbeddedRule {
  source: string;
  description: string;
  globs: string[];
  targets: string[];
  body: string;
}

export interface ExtractedEmbeddedRules {
  rootContent: string;
  rules: ExtractedEmbeddedRule[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedBlockPattern(start: string, end: string): RegExp {
  return new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'g');
}

export function replaceManagedBlock(
  content: string,
  start: string,
  end: string,
  block: string,
): string {
  const pattern = managedBlockPattern(start, end);
  if (pattern.test(content)) {
    return content.replace(pattern, block).trim();
  }
  const trimmed = content.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

export function stripManagedBlock(content: string, start: string, end: string): string {
  return content.replace(managedBlockPattern(start, end), '').trim();
}

function ruleSource(source: string): string {
  const normalized = source.replace(/\\/g, '/');
  const meshIndex = normalized.lastIndexOf('.agentsmesh/');
  if (meshIndex >= 0) return normalized.slice(meshIndex + '.agentsmesh/'.length);
  if (normalized.startsWith('rules/')) return normalized;
  return join('rules', basename(normalized)).replace(/\\/g, '/');
}

function markerForRule(rule: CanonicalRule): EmbeddedRuleMarker {
  return {
    source: ruleSource(rule.source),
    description: rule.description,
    globs: rule.globs,
    targets: rule.targets,
  };
}

function embeddedRuleStart(rule: CanonicalRule): string {
  return `${EMBEDDED_RULE_START_PREFIX}${JSON.stringify(markerForRule(rule))}${EMBEDDED_RULE_START_SUFFIX}`;
}

function renderRule(rule: CanonicalRule): string {
  const parts = [embeddedRuleStart(rule)];
  if (rule.description.trim()) {
    parts.push(`## ${rule.description.trim()}`, '');
  }
  parts.push(rule.body.trim(), EMBEDDED_RULE_END);
  return parts.filter((part) => part.length > 0).join('\n');
}

export function renderEmbeddedRulesBlock(rules: readonly CanonicalRule[]): string {
  if (rules.length === 0) return '';
  return [EMBEDDED_RULES_START, ...rules.map(renderRule), EMBEDDED_RULES_END].join('\n');
}

export function appendEmbeddedRulesBlock(content: string, rules: readonly CanonicalRule[]): string {
  const block = renderEmbeddedRulesBlock(rules);
  const withoutExisting = stripManagedBlock(content, EMBEDDED_RULES_START, EMBEDDED_RULES_END);
  if (!block) return withoutExisting;
  return withoutExisting ? `${withoutExisting}\n\n${block}` : block;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function parseMarker(value: string): EmbeddedRuleMarker | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.source !== 'string' || !record.source.startsWith('rules/')) return null;
    return {
      source: record.source,
      description: typeof record.description === 'string' ? record.description : '',
      globs: toStringArray(record.globs),
      targets: toStringArray(record.targets),
    };
  } catch {
    return null;
  }
}

function stripGeneratedHeading(body: string, description: string): string {
  const trimmed = body.trim();
  if (!description.trim()) return trimmed;
  const heading = `## ${description.trim()}`;
  return trimmed.startsWith(heading) ? trimmed.slice(heading.length).trim() : trimmed;
}

export function extractEmbeddedRules(content: string): ExtractedEmbeddedRules {
  const rules: ExtractedEmbeddedRule[] = [];
  const outerPattern = managedBlockPattern(EMBEDDED_RULES_START, EMBEDDED_RULES_END);
  const rootContent = content.replace(outerPattern, (block) => {
    const inner = block.replace(EMBEDDED_RULES_START, '').replace(EMBEDDED_RULES_END, '').trim();
    const entryPattern = new RegExp(
      `${escapeRegExp(EMBEDDED_RULE_START_PREFIX)}([\\s\\S]*?)${escapeRegExp(EMBEDDED_RULE_START_SUFFIX)}([\\s\\S]*?)${escapeRegExp(EMBEDDED_RULE_END)}`,
      'g',
    );
    for (const match of inner.matchAll(entryPattern)) {
      const markerText = match[1];
      const body = match[2];
      if (markerText === undefined || body === undefined) continue;
      const marker = parseMarker(markerText);
      if (!marker) continue;
      rules.push({
        ...marker,
        body: stripGeneratedHeading(body, marker.description),
      });
    }
    return '';
  });
  return { rootContent: rootContent.trim(), rules };
}
