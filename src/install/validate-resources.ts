/**
 * Validate discovered resources for install.
 */

import { basename } from 'node:path';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalRule,
  CanonicalSkill,
} from '../core/types.js';

export interface SkillValidation {
  skill: CanonicalSkill;
  ok: boolean;
  reason?: string;
}

export function validateSkill(skill: CanonicalSkill): SkillValidation {
  if (!skill.description.trim()) {
    return { skill, ok: false, reason: 'missing description in frontmatter' };
  }
  return { skill, ok: true };
}

export interface RuleValidation {
  rule: CanonicalRule;
  ok: boolean;
  reason?: string;
}

export function validateRule(rule: CanonicalRule): RuleValidation {
  if (!rule.description.trim()) {
    return { rule, ok: false, reason: 'missing description in frontmatter' };
  }
  return { rule, ok: true };
}

export interface CommandValidation {
  command: CanonicalCommand;
  ok: boolean;
  reason?: string;
}

export function validateCommand(command: CanonicalCommand): CommandValidation {
  if (!command.description.trim()) {
    return { command, ok: false, reason: 'missing description in frontmatter' };
  }
  return { command, ok: true };
}

export interface AgentValidation {
  agent: CanonicalAgent;
  ok: boolean;
  reason?: string;
}

export function validateAgent(agent: CanonicalAgent): AgentValidation {
  if (!agent.description.trim()) {
    return { agent, ok: false, reason: 'missing description in frontmatter' };
  }
  return { agent, ok: true };
}

export function ruleSlug(rule: CanonicalRule): string {
  return basename(rule.source).replace(/\.md$/i, '');
}
