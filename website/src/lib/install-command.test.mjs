import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_METHODS, libraryInstallCommand, packInstallCommand } from './install-command.mjs';

test('libraryInstallCommand: local vs global', () => {
  assert.equal(libraryInstallCommand(false), 'pnpm install agentsmesh');
  assert.equal(libraryInstallCommand(true), 'pnpm add --global agentsmesh');
});

test('packInstallCommand: quotes the source and targets claude-code by default', () => {
  assert.equal(
    packInstallCommand({ link: 'https://github.com/a/b', kind: 'skills', global: false }),
    "agentsmesh install 'https://github.com/a/b' --target claude-code --as skills",
  );
});

test('packInstallCommand: places --global right after install', () => {
  assert.equal(
    packInstallCommand({ link: 'https://x.dev/p', kind: 'agents', global: true }),
    "agentsmesh install --global 'https://x.dev/p' --target claude-code --as agents",
  );
});

test('packInstallCommand: escapes single quotes inside the source', () => {
  assert.equal(
    packInstallCommand({ link: "https://x.dev/it's", kind: 'commands', global: false }),
    "agentsmesh install 'https://x.dev/it'\\''s' --target claude-code --as commands",
  );
});

test('INSTALL_METHODS: three unique ids, each with a label and a command', () => {
  assert.deepEqual(
    INSTALL_METHODS.map((m) => m.id),
    ['brew', 'curl', 'npm'],
  );
  for (const m of INSTALL_METHODS) {
    assert.ok(m.label.length > 0);
    assert.ok(m.command.includes('agentsmesh'));
  }
});

test('packInstallCommand: empty source still yields a quoted argument and honours a custom target', () => {
  assert.equal(
    packInstallCommand({ link: '', kind: 'skills', global: false, target: 'cursor' }),
    "agentsmesh install '' --target cursor --as skills",
  );
});
