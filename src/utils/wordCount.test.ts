import { describe, expect, it } from 'vitest';
import { getDocumentStats } from './wordCount';

describe('getDocumentStats', () => {
  it('counts mixed Chinese and English content', () => {
    expect(getDocumentStats('你好 hello world\n\n下一段')).toMatchObject({
      words: 7,
      characters: 19,
      lines: 3,
      paragraphs: 2,
    });
  });

  it('returns zero for an empty document', () => {
    expect(getDocumentStats('')).toMatchObject({ words: 0, characters: 0, lines: 0, paragraphs: 0 });
  });
});
