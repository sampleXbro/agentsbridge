/**
 * Pure builders for the auto-generated doc blocks rendered by render-support-matrix.ts.
 * Kept separate so the orchestrator stays small.
 */
import type { SupportLevel } from '../src/core/result-types.js';
import { SUPPORT_MATRIX } from '../src/core/matrix/data.js';
import { TARGET_IDS } from '../src/targets/catalog/target-ids.js';
import type { TargetCapabilityValue } from '../src/targets/catalog/capabilities.js';
import {
  TARGET_REGISTRY,
  listTargets,
  targetsByCategory,
} from '../src/targets/catalog/target-metadata-registry.js';
import { getBuiltinTargetDefinition } from '../src/targets/catalog/builtin-targets.js';

export const TARGET_LABELS: Record<string, string> = Object.fromEntries(
  TARGET_IDS.map((id) => [id, TARGET_REGISTRY[id]!.metadata.displayName]),
);

const FEATURE_ROWS: [string, keyof typeof SUPPORT_MATRIX][] = [
  ['Rules', 'rules'],
  ['Additional Rules', 'additionalRules'],
  ['Commands', 'commands'],
  ['Agents', 'agents'],
  ['Skills', 'skills'],
  ['MCP Servers', 'mcp'],
  ['Hooks', 'hooks'],
  ['Ignore', 'ignore'],
  ['Permissions', 'permissions'],
];

const LEVEL_LABELS: Record<SupportLevel, string> = {
  native: 'Native',
  embedded: 'Embedded',
  partial: 'Partial',
  none: '—',
};

function cellLabel(c: TargetCapabilityValue): string {
  const base = LEVEL_LABELS[c.level];
  if (c.flavor && c.flavor !== 'standard') {
    return `${base} (${c.flavor})`;
  }
  return base;
}

export function buildMarkdownTable(matrix: typeof SUPPORT_MATRIX): string {
  const headers = ['Feature', ...TARGET_IDS.map((id) => TARGET_LABELS[id])];
  const header = `| ${headers.join(' | ')} |`;
  const sep = `|${headers.map((h) => (h === 'Feature' ? '---' : ':-----------:')).join('|')}|`;
  const lines = FEATURE_ROWS.map(([label, key]) => {
    const cells = [label, ...TARGET_IDS.map((t) => cellLabel(matrix[key][t]))];
    return `| ${cells.join(' | ')} |`;
  });
  return [header, sep, ...lines].join('\n');
}

export function buildImportTargetsTable(): string {
  const header = '| Target ID | Tool | Reads from |';
  const sep = '|-----------|------|-----------|';
  const lines = listTargets().map((entry) => {
    const id = `\`${entry.id}\``;
    const tool = `[${entry.metadata.displayName}](${entry.metadata.officialUrl})`;
    const root = entry.importRoot.project ? `\`${entry.importRoot.project}\`` : '—';
    return `| ${id} | ${tool} | ${root} |`;
  });
  return [header, sep, ...lines].join('\n');
}

const CATEGORY_LABELS: Record<'cli' | 'ide' | 'agent-platform', string> = {
  cli: 'CLI agents',
  ide: 'IDE integrations',
  'agent-platform': 'Cloud agent platforms',
};

export function buildToolList(): string {
  const groups = targetsByCategory();
  const orderedCategories: (keyof typeof CATEGORY_LABELS)[] = ['cli', 'ide', 'agent-platform'];
  const sections = orderedCategories.map((cat) => {
    const items = groups[cat]
      .map((entry) => `[${entry.metadata.displayName}](${entry.metadata.officialUrl})`)
      .join(', ');
    return `- **${CATEGORY_LABELS[cat]}:** ${items}.`;
  });
  return sections.join('\n');
}

const CATEGORY_BADGE: Record<'cli' | 'ide' | 'agent-platform', string> = {
  cli: 'CLI agent',
  ide: 'IDE integration',
  'agent-platform': 'Cloud agent platform',
};

function dottedHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function buildToolDetails(): string {
  return listTargets()
    .map((entry) => {
      const descriptor = getBuiltinTargetDefinition(entry.id);
      const project = descriptor?.project;
      const global = descriptor?.globalSupport?.layout;
      const lines: string[] = [
        `### ${entry.metadata.displayName}`,
        ``,
        `${CATEGORY_BADGE[entry.metadata.category]} · [${dottedHost(entry.metadata.officialUrl)}](${entry.metadata.officialUrl})`,
        ``,
        `${entry.metadata.shortDescription}.`,
        ``,
      ];
      const projectBits: string[] = [];
      if (project?.rootInstructionPath) projectBits.push(`root \`${project.rootInstructionPath}\``);
      if (project?.skillDir) projectBits.push(`skills \`${project.skillDir}/\``);
      if (projectBits.length > 0) {
        lines.push(`**Project mode:** ${projectBits.join(', ')}.`);
      }
      const globalBits: string[] = [];
      if (global?.rootInstructionPath) globalBits.push(`root \`${global.rootInstructionPath}\``);
      if (global?.skillDir) globalBits.push(`skills \`${global.skillDir}/\``);
      if (globalBits.length > 0) {
        lines.push(`**Global mode:** ${globalBits.join(', ')}.`);
      } else if (descriptor?.globalSupport) {
        lines.push(`**Global mode:** see the [Global mode paths table](#global-mode).`);
      }
      lines.push(``);
      lines.push(
        `See the [project feature matrix](#feature-matrix-project-scope) and [global feature matrix](#feature-matrix-global-scope) for per-feature support.`,
      );
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}
