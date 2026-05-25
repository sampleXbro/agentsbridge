import { describe, it, expect } from 'vitest';
import { PassThrough, Readable, Writable } from 'node:stream';
import { readLine } from '../../../../src/install/prompts/prompt-io.js';

interface Capture {
  readonly stream: Writable;
  readonly text: () => string;
}

function makeCapture(): Capture {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });
  return { stream, text: () => Buffer.concat(chunks).toString('utf8') };
}

describe('readLine', () => {
  it('resolves to the first line from injected input', async () => {
    const input = Readable.from(['yes\n'], { objectMode: false });
    const { stream: output } = makeCapture();

    const answer = await readLine('continue?', { input, output });
    expect(answer).toBe('yes');
  });

  it('returns only the first line when input contains multiple lines', async () => {
    const input = Readable.from(['first\nsecond\n'], { objectMode: false });
    const { stream: output } = makeCapture();

    const answer = await readLine('pick one', { input, output });
    expect(answer).toBe('first');
  });

  it('echoes the prompt to the injected output stream', async () => {
    const input = Readable.from(['ok\n'], { objectMode: false });
    const capture = makeCapture();

    await readLine('Install [a/n/s] ', { input, output: capture.stream });
    expect(capture.text()).toContain('Install [a/n/s] ');
  });

  it("resolves to '' when input ends without any data (EOF)", async () => {
    const input = new PassThrough();
    input.end();
    const { stream: output } = makeCapture();

    const answer = await readLine('continue?', { input, output });
    expect(answer).toBe('');
  });

  it("resolves to '' when input is already-closed synchronously and does not hang", async () => {
    const input = Readable.from([], { objectMode: false });
    const { stream: output } = makeCapture();

    const racePromise = Promise.race([
      readLine('continue?', { input, output }),
      new Promise<'__timeout__'>((resolve) => {
        setTimeout(() => resolve('__timeout__'), 1000);
      }),
    ]);
    const result = await racePromise;
    expect(result).toBe('');
  });

  it("preserves an empty line answer as '' when user only presses Enter", async () => {
    const input = Readable.from(['\n'], { objectMode: false });
    const { stream: output } = makeCapture();

    const answer = await readLine('press enter', { input, output });
    expect(answer).toBe('');
  });

  it('trims the trailing newline but preserves leading/trailing spaces inside the answer', async () => {
    const input = Readable.from(['  spaced  \n'], { objectMode: false });
    const { stream: output } = makeCapture();

    const answer = await readLine('input', { input, output });
    expect(answer).toBe('  spaced  ');
  });
});
