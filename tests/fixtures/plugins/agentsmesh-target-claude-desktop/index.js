/**
 * Claude Desktop Agent Configuration Sync
 *
 * This plugin syncs AgentsMesh rules and agents into Claude Desktop's
 * native configuration at ~/.claude/claude.json.
 *
 * Installation:
 *   agentsmesh plugin add agentsmesh-target-claude-desktop
 *   agentsmesh generate
 *
 * Configuration:
 *   Edit agentsmesh.yaml to add 'claude-desktop' to pluginTargets:
 *   pluginTargets: ['claude-desktop']
 *
 * Claude Desktop reads ~/.claude/claude.json and applies system instructions
 * from the configured profiles. AgentsMesh syncs your root rule and agents
 * as named profiles that Claude Desktop can activate.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Helper: try to read existing Claude Desktop config
function readExistingConfig(projectRoot) {
  try {
    const home = require('os').homedir();
    const configPath = join(home, '.claude', 'claude.json');
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // File doesn't exist or is invalid JSON
  }
  return { profiles: {}, currentProfile: 'default' };
}

export const descriptor = {
  id: 'claude-desktop',

  generators: {
    name: 'claude-desktop',

    /**
     * Sync root rule as the default system instruction, and agents as named profiles.
     * Combining both here avoids writing to .claude/claude.json from two generators.
     */
    generateRules(canonical) {
      const rootRule = canonical.rules.find((r) => r.root);
      if (!rootRule) return [];

      const config = {
        profiles: {
          default: {
            name: 'Default',
            system_prompt: rootRule.body,
          },
        },
        currentProfile: 'default',
      };

      // Add agents as named profiles
      for (const agent of canonical.agents) {
        config.profiles[agent.name] = {
          name: agent.name,
          system_prompt: agent.body,
          tools: agent.tools || [],
        };
      }

      return [
        {
          path: '.claude/claude.json',
          content: JSON.stringify(config, null, 2),
        },
      ];
    },

    /**
     * Agents are written in generateRules to avoid emitting the same path twice.
     */
    generateAgents(_canonical) {
      return [];
    },

    /**
     * Stub: commands not directly supported in Claude Desktop native config.
     */
    generateCommands(_canonical) {
      return [];
    },

    /**
     * Stub: skills not directly supported.
     */
    generateSkills(_canonical) {
      return [];
    },

    /**
     * Stub: MCP servers configured separately in Claude Desktop.
     */
    generateMcp(_canonical) {
      return [];
    },

    /**
     * Stub: hooks not applicable.
     */
    generateHooks(_canonical) {
      return [];
    },

    /**
     * Stub: permissions not applicable to Claude Desktop.
     */
    generatePermissions(_canonical) {
      return [];
    },

    /**
     * Stub: ignore file not needed for Claude Desktop.
     */
    generateIgnore(_canonical) {
      return [];
    },

    /**
     * Custom lint: warn if no root rule is defined.
     */
    lint(canonical) {
      const issues = [];

      const hasRoot = canonical.rules.some((r) => r.root);
      if (!hasRoot) {
        issues.push({
          level: 'warning',
          file: '',
          target: 'claude-desktop',
          message: 'No root rule found. Claude Desktop needs system instructions.',
        });
      }

      return issues;
    },

    /**
     * Claude Desktop doesn't support import of its native config format.
     * Users manually edit ~/.claude/claude.json or use Claude Desktop UI.
     */
    async importFrom(_projectRoot, _options) {
      return [];
    },
  },

  /**
   * Capability matrix: what AgentsMesh features Claude Desktop supports.
   */
  capabilities: {
    rules: 'native',        // Root rule → system_prompt
    additionalRules: 'none', // Claude Desktop doesn't support multiple rules
    commands: 'none',       // Not a native Claude Desktop feature
    agents: 'native',       // Agents → profiles
    skills: 'none',         // Skills not supported
    mcp: 'none',            // MCP configured separately
    hooks: 'none',          // Hooks not applicable
    ignore: 'none',         // Ignore not applicable
    permissions: 'none',    // Permissions not applicable
  },

  /**
   * Project-level layout: generates to .claude/ directory.
   */
  project: {
    paths: {
      rulePath(_slug, _rule) {
        return '.claude/claude.json';
      },
      commandPath(_name, _config) {
        return null; // Not supported
      },
      agentPath(_name, _config) {
        return '.claude/claude.json'; // Agents merged into same file
      },
    },
  },

  globalSupport: {
    capabilities: {
      rules: 'native',
      additionalRules: 'none',
      commands: 'none',
      agents: 'native',
      skills: 'none',
      mcp: 'none',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    detectionPaths: ['~/.claude/claude.json'],
    layout: {
      paths: {
        rulePath(_slug, _rule) {
          return '~/.claude/claude.json';
        },
        commandPath(_name, _config) {
          return null;
        },
        agentPath(_name, _config) {
          return '~/.claude/claude.json';
        },
      },
      rewriteGeneratedPath(path) {
        if (path === '.claude/claude.json') {
          return '~/.claude/claude.json';
        }
        return path;
      },
    },
  },

  /**
   * Import path builder: not applicable since we don't import.
   */
  async buildImportPaths(_refs, _projectRoot, _scope) {
    // No-op
  },

  /**
   * Detection: if ~/.claude/claude.json exists, Claude Desktop is configured.
   */
  detectionPaths: ['.claude/claude.json', '~/.claude/claude.json'],

  /**
   * Lint rules function: same as the inline lint() above.
   * (This is redundant here; shows both patterns are supported.)
   */
  lintRules(canonical, _projectRoot, _projectFiles, _options) {
    const issues = [];
    if (!canonical.rules.some((r) => r.root)) {
      issues.push({
        level: 'warning',
        file: '',
        target: 'claude-desktop',
        message:
          'Claude Desktop requires a root rule. Add one to .agentsmesh/rules/_root.md',
      });
    }
    return issues;
  },

  emptyImportMessage:
    'No Claude Desktop config found. Run "agentsmesh generate" to create ~/.claude/claude.json from your rules and agents.',
};
