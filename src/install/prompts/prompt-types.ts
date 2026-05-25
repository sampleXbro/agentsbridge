/**
 * Shared injectable adapter contract for install-time prompts.
 *
 * Every prompt module (bulk-prompt, broken-link-prompt, modified-files-prompt)
 * receives a `PromptAdapter` instead of touching stdin/stdout directly. The
 * default binding wraps `prompt-io.readLine` + `process.stdout.write`; tests
 * inject a fake that records both sides for assertions.
 */

export interface PromptAdapter {
  /**
   * Display `prompt` and resolve with the user's response. Implementations
   * MUST resolve to `''` on EOF / Ctrl-D so callers can treat "no input"
   * uniformly without distinguishing abort from blank.
   */
  readonly ask: (prompt: string) => Promise<string>;
  /** Write `chunk` to the output stream (banners, info lines). */
  readonly write: (chunk: string) => void;
}
