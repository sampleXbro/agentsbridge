/**
 * Comprehensive test plugin covering ALL TargetDescriptor features:
 * - All canonical features (rules, commands, agents, skills, mcp, hooks, permissions, ignore)
 * - generators.lint hook + generators.primaryRootInstructionPath
 * - Per-feature lint hooks (lint.commands, lint.mcp, lint.permissions, lint.hooks, lint.ignore)
 * - Project and global layouts with rootInstructionPath, skillDir, outputFamilies,
 *   renderPrimaryRootInstruction, rewriteGeneratedPath, mirrorGlobalPath
 * - Import path mapping (buildImportPaths)
 * - Capability levels (native, embedded, partial, none, object form)
 * - globalSupport
 * - supportsConversion (commands + agents)
 * - globalSupport.scopeExtras
 * - sharedArtifacts ownership declaration
 * - emitScopedSettings native settings sidecar
 * - postProcessHookOutputs async hook post-processing
 * - Detection paths
 */

/* eslint-disable no-unused-vars */

export const descriptor = {
  id: 'rich-plugin',

  // ──── Generators (all 8 feature generators + lint + primaryRootInstructionPath) ──
  generators: {
    name: 'rich-plugin',
    primaryRootInstructionPath: '.rich/ROOT.md',

    generateRules(canonical) {
      const results = [];
      const rootRule = canonical.rules.find((r) => r.root);
      if (rootRule) {
        results.push({
          path: '.rich/ROOT.md',
          content: `# Rich Plugin Root\n\n${rootRule.body}`,
        });
      }
      for (const rule of canonical.rules.filter((r) => !r.root)) {
        const slug = rule.source.split('/').pop().replace(/\.md$/, '');
        results.push({
          path: `.rich/rules/${slug}.md`,
          content: `# ${rule.description}\n\n${rule.body}`,
        });
      }
      return results;
    },

    generateCommands(canonical) {
      return canonical.commands.map((cmd) => ({
        path: `.rich/commands/${cmd.name}.md`,
        content: `# Command: ${cmd.name}\n\n${cmd.description}\n\n${cmd.body}`,
      }));
    },

    generateAgents(canonical) {
      return canonical.agents.map((agent) => ({
        path: `.rich/agents/${agent.name}.md`,
        content: `# Agent: ${agent.name}\n\n${agent.body}`,
      }));
    },

    generateSkills(canonical) {
      return canonical.skills.map((skill) => ({
        path: `.rich/skills/${skill.name}/SKILL.md`,
        content: `# Skill: ${skill.name}\n\n${skill.body}`,
      }));
    },

    generateMcp(canonical) {
      if (!canonical.mcp) return [];
      return [{
        path: `.rich/mcp.json`,
        content: JSON.stringify(canonical.mcp, null, 2),
      }];
    },

    generatePermissions(canonical) {
      if (!canonical.permissions) return [];
      return [{
        path: `.rich/permissions.json`,
        content: JSON.stringify(canonical.permissions, null, 2),
      }];
    },

    generateHooks(canonical) {
      if (!canonical.hooks) return [];
      return [{
        path: `.rich/hooks.json`,
        content: JSON.stringify(canonical.hooks, null, 2),
      }];
    },

    generateIgnore(canonical) {
      if (canonical.ignore.length === 0) return [];
      return [{
        path: `.richignore`,
        content: canonical.ignore.join('\n'),
      }];
    },

    lint(canonical) {
      const issues = [];
      for (const rule of canonical.rules) {
        if (!rule.root && (!rule.description || rule.description.trim().length === 0)) {
          issues.push({
            level: 'error',
            file: rule.source,
            target: 'rich-plugin',
            message: 'Non-root rule must have a description',
          });
        }
      }
      return issues;
    },

    async importFrom(_projectRoot, _options) {
      return [];
    },
  },

  // ──── Capabilities (all 9 features with mixed levels) ────────────────────
  capabilities: {
    rules: 'native',
    additionalRules: 'partial',
    commands: 'embedded',
    agents: { level: 'embedded', flavor: 'markdown' },
    skills: 'partial',
    mcp: 'native',
    hooks: 'embedded',
    ignore: 'native',
    permissions: 'partial',
  },

  // ──── Per-feature Lint Hooks ───────────────────────────────────────────────
  lint: {
    commands(canonical) {
      const issues = [];
      for (const cmd of canonical.commands) {
        if (!cmd.description || cmd.description.trim().length === 0) {
          issues.push({
            level: 'warning',
            file: cmd.source || '',
            target: 'rich-plugin',
            message: `Command '${cmd.name}' is missing a description`,
          });
        }
      }
      return issues;
    },
    mcp(canonical) {
      const issues = [];
      if (canonical.mcp && canonical.mcp.mcpServers) {
        for (const [name, server] of Object.entries(canonical.mcp.mcpServers)) {
          if (!server.command && !server.url) {
            issues.push({
              level: 'error',
              file: '',
              target: 'rich-plugin',
              message: `MCP server '${name}' has no command or url`,
            });
          }
        }
      }
      return issues;
    },
    permissions(canonical) {
      const issues = [];
      if (canonical.permissions && canonical.permissions.deny) {
        for (const denied of canonical.permissions.deny) {
          if (canonical.permissions.allow && canonical.permissions.allow.includes(denied)) {
            issues.push({
              level: 'error',
              file: '',
              target: 'rich-plugin',
              message: `Permission '${denied}' is both allowed and denied`,
            });
          }
        }
      }
      return issues;
    },
    hooks(canonical) {
      const issues = [];
      if (canonical.hooks) {
        for (const [event, hookList] of Object.entries(canonical.hooks)) {
          if (Array.isArray(hookList)) {
            for (const hook of hookList) {
              if (!hook.command || hook.command.trim().length === 0) {
                issues.push({
                  level: 'warning',
                  file: '',
                  target: 'rich-plugin',
                  message: `Hook in '${event}' has an empty command`,
                });
              }
            }
          }
        }
      }
      return issues;
    },
    ignore(canonical) {
      const issues = [];
      const seen = new Set();
      for (const pattern of canonical.ignore) {
        if (seen.has(pattern)) {
          issues.push({
            level: 'warning',
            file: '',
            target: 'rich-plugin',
            message: `Duplicate ignore pattern: '${pattern}'`,
          });
        }
        seen.add(pattern);
      }
      return issues;
    },
  },

  // ──── Supports Conversion (commands + agents) ──────────────────────────────
  supportsConversion: { commands: true, agents: true },

  // ──── Project Layout ──────────────────────────────────────────────────────
  project: {
    rootInstructionPath: '.rich/ROOT.md',
    skillDir: '.rich/skills',
    managedOutputs: {
      dirs: ['.rich/rules', '.rich/commands', '.rich/agents', '.rich/skills'],
      files: ['.richignore', '.rich/ROOT.md', '.rich/mcp.json', '.rich/hooks.json', '.rich/permissions.json', '.rich/settings.json'],
    },
    outputFamilies: [
      { id: 'rules', kind: 'primary', pathPrefix: '.rich/rules/' },
      { id: 'commands', kind: 'additional', pathPrefix: '.rich/commands/' },
      { id: 'agents', kind: 'additional', pathPrefix: '.rich/agents/' },
    ],
    paths: {
      rulePath(slug, _rule) {
        return `.rich/rules/${slug}.md`;
      },
      commandPath(name, _config) {
        return `.rich/commands/${name}.md`;
      },
      agentPath(name, _config) {
        return `.rich/agents/${name}.md`;
      },
    },
    mirrorGlobalPath(_path, _targets) {
      return null;
    },
  },

  // ──── Shared Artifacts ─────────────────────────────────────────────────────
  sharedArtifacts: {
    '.rich/skills/': 'owner',
  },

  // ──── Global Support ──────────────────────────────────────────────────────
  globalSupport: {
    capabilities: {
      rules: 'native',
      additionalRules: 'none',
      commands: 'embedded',
      agents: 'embedded',
      skills: 'none',
      mcp: 'native',
      hooks: 'native',
      ignore: 'native',
      permissions: 'native',
    },
    detectionPaths: [
      '.rich',
      '.rich/ROOT.md',
      '.richignore',
    ],
    layout: {
      rootInstructionPath: '.rich/ROOT.md',
      skillDir: '.rich/skills',
      outputFamilies: [
        { id: 'rules', kind: 'primary', pathPrefix: '.rich/rules/' },
        { id: 'agents', kind: 'additional', pathPrefix: '.rich/agents/' },
      ],
      renderPrimaryRootInstruction(canonical) {
        const rootRule = canonical.rules.find((r) => r.root);
        if (!rootRule) return '';
        return `# Rich Plugin Global\n\n${rootRule.body}\n\n<!-- managed by agentsmesh -->`;
      },
      paths: {
        rulePath(slug, _rule) {
          return `.rich/rules/${slug}.md`;
        },
        commandPath(name, _config) {
          return `.rich/commands/${name}.md`;
        },
        agentPath(name, _config) {
          return `.rich/agents/${name}.md`;
        },
      },
      rewriteGeneratedPath(path) {
        return path;
      },
    },
    async scopeExtras(canonical, _projectRoot, scope, enabledFeatures) {
      const results = [];
      if (scope === 'global' && enabledFeatures.has('rules')) {
        results.push({
          path: '.rich/scope-info.txt',
          content: `scope=${scope}\nfeatures=${[...enabledFeatures].join(',')}`,
        });
      }
      return results;
    },
  },

  // ──── Scoped Settings Sidecar ──────────────────────────────────────────────
  emitScopedSettings(canonical, scope) {
    const settings = {
      version: 1,
      scope,
      featureCount: canonical.rules.length + canonical.commands.length + canonical.agents.length,
    };
    return [{ path: '.rich/settings.json', content: JSON.stringify(settings, null, 2) }];
  },

  // ──── Post-process Hook Outputs ────────────────────────────────────────────
  async postProcessHookOutputs(_projectRoot, canonical, outputs) {
    const processed = [...outputs];
    for (const output of outputs) {
      if (output.path.endsWith('.json') && output.path.includes('hooks')) {
        processed.push({
          path: output.path.replace('.json', '.wrapper.sh'),
          content: '#!/bin/sh\n# auto-generated hook wrapper\nexec "$@"\n',
        });
      }
    }
    return processed;
  },

  // ──── Import Path Mapping ──────────────────────────────────────────────────
  async buildImportPaths(refs, _projectRoot, _scope) {
    refs.set('.rich/custom-rule.md', 'CUSTOM.md');
    refs.set('.rich/ROOT.md', '.agentsmesh/rules/_root.md');
  },

  // ──── Detection Paths ──────────────────────────────────────────────────────
  detectionPaths: [
    '.rich',
    '.rich/ROOT.md',
    '.rich/commands',
    '.rich/agents',
    '.richignore',
  ],

  // ──── Lint Rules Callback ──────────────────────────────────────────────────
  lintRules(canonical, _projectRoot, _projectFiles, _options) {
    const issues = [];
    for (const rule of canonical.rules) {
      if (!rule.body || rule.body.trim().length === 0) {
        issues.push({
          level: 'warning',
          file: rule.source,
          target: 'rich-plugin',
          message: 'Rule has empty body',
        });
      }
    }
    return issues;
  },

  // ──── Empty Import Message ─────────────────────────────────────────────────
  emptyImportMessage: 'No Rich plugin config found (.rich/ directory).',
};
