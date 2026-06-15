/**
 * Qwen Code lint tests.
 *
 * lintHooks was removed when hooks capability was promoted to 'native'.
 * Hooks are now generated via generateHooks() in generator.ts.
 */

import { describe, it } from 'vitest';

describe('qwen-code lint', () => {
  it('has no stale lintHooks stub (hooks is now native)', () => {
    // lintHooks was removed — this test documents the intentional absence
  });
});
