import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_METHODS } from './install-command.mjs';

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
