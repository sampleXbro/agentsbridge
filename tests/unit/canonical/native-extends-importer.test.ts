import { describe, expect, it, vi } from 'vitest';
import { importNativeToCanonical } from '../../../src/canonical/native-extends-importer.js';

const mockClaudeImport = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    {
      fromTool: 'claude-code',
      fromPath: 'CLAUDE.md',
      toPath: '.agentsbridge/rules/_root.md',
      feature: 'rules',
    },
  ]),
);
const mockCursorImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockCopilotImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGeminiImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockCodexImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockWindsurfImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockClineImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockContinueImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockJunieImport = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../../../src/targets/claude-code/importer.js', () => ({
  importFromClaudeCode: mockClaudeImport,
}));
vi.mock('../../../src/targets/cursor/importer.js', () => ({
  importFromCursor: mockCursorImport,
}));
vi.mock('../../../src/targets/copilot/importer.js', () => ({
  importFromCopilot: mockCopilotImport,
}));
vi.mock('../../../src/targets/gemini-cli/importer.js', () => ({
  importFromGemini: mockGeminiImport,
}));
vi.mock('../../../src/targets/codex-cli/importer.js', () => ({
  importFromCodex: mockCodexImport,
}));
vi.mock('../../../src/targets/windsurf/importer.js', () => ({
  importFromWindsurf: mockWindsurfImport,
}));
vi.mock('../../../src/targets/cline/importer.js', () => ({
  importFromCline: mockClineImport,
}));
vi.mock('../../../src/targets/continue/importer.js', () => ({
  importFromContinue: mockContinueImport,
}));
vi.mock('../../../src/targets/junie/importer.js', () => ({
  importFromJunie: mockJunieImport,
}));

describe('importNativeToCanonical', () => {
  it('dispatches to claude-code importer and returns its results', async () => {
    const results = await importNativeToCanonical('/repo', 'claude-code');
    expect(mockClaudeImport).toHaveBeenCalledWith('/repo');
    expect(results).toHaveLength(1);
    expect(results[0]?.fromTool).toBe('claude-code');
  });

  it('dispatches to cursor importer', async () => {
    await importNativeToCanonical('/repo', 'cursor');
    expect(mockCursorImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to copilot importer', async () => {
    await importNativeToCanonical('/repo', 'copilot');
    expect(mockCopilotImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to gemini-cli importer', async () => {
    await importNativeToCanonical('/repo', 'gemini-cli');
    expect(mockGeminiImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to codex-cli importer', async () => {
    await importNativeToCanonical('/repo', 'codex-cli');
    expect(mockCodexImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to windsurf importer', async () => {
    await importNativeToCanonical('/repo', 'windsurf');
    expect(mockWindsurfImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to cline importer', async () => {
    await importNativeToCanonical('/repo', 'cline');
    expect(mockClineImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to continue importer', async () => {
    await importNativeToCanonical('/repo', 'continue');
    expect(mockContinueImport).toHaveBeenCalledWith('/repo');
  });

  it('dispatches to junie importer', async () => {
    await importNativeToCanonical('/repo', 'junie');
    expect(mockJunieImport).toHaveBeenCalledWith('/repo');
  });

  it('throws for unknown target name', async () => {
    await expect(importNativeToCanonical('/repo', 'unknown-tool')).rejects.toThrow(
      /No importer registered for native target: unknown-tool/,
    );
  });
});
