import { describe, expect, it } from 'vitest';
import {
  isLowSignalKeyword,
  MAX_RECOMMENDED_KEYWORD_TOKENS,
} from '../../../src/lessons/keyword-signal.js';

describe('isLowSignalKeyword', () => {
  it('does not flag a short distinctive phrase', () => {
    expect(isLowSignalKeyword('filterOption cast')).toBe(false);
    expect(isLowSignalKeyword('Maximum update depth')).toBe(false);
    expect(isLowSignalKeyword('renderHook stable reference')).toBe(false);
  });

  it('flags a long descriptive pattern that recall can never match', () => {
    expect(
      isLowSignalKeyword(
        'antd Form.useForm getFieldsValue Select filterOption FormData generic cast',
      ),
    ).toBe(true);
    expect(
      isLowSignalKeyword(
        'renderHook hook test Maximum update depth stable reference dependency array',
      ),
    ).toBe(true);
  });

  it('does not flag at exactly the recommended token count', () => {
    // Build a pattern with exactly MAX_RECOMMENDED_KEYWORD_TOKENS distinct tokens.
    const pattern = Array.from({ length: MAX_RECOMMENDED_KEYWORD_TOKENS }, (_, i) => `tok${i}`).join(
      ' ',
    );
    expect(isLowSignalKeyword(pattern)).toBe(false);
  });

  it('flags one token past the recommended count', () => {
    const pattern = Array.from({ length: MAX_RECOMMENDED_KEYWORD_TOKENS + 1 }, (_, i) => `tok${i}`).join(
      ' ',
    );
    expect(isLowSignalKeyword(pattern)).toBe(true);
  });

  it('counts only matchable tokens (stopwords and 1-char tokens do not inflate)', () => {
    // tokenize drops stopwords + <2-char tokens, mirroring the recall needle.
    expect(isLowSignalKeyword('a b c d e f g h to of in and or for')).toBe(false);
  });
});
