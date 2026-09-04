import { describe, expect, it } from 'vitest';
import { extractHeadings } from './markdownHeadings';

describe('extractHeadings', () => {
  it('extracts heading levels and source lines', () => {
    expect(extractHeadings('# Intro\ntext\n### Details')).toEqual([
      { level: 1, text: 'Intro', line: 0 },
      { level: 3, text: 'Details', line: 2 },
    ]);
  });
});
