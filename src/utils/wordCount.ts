export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  paragraphs: number;
  readingMinutes: number;
}

export function getDocumentStats(text: string): DocumentStats {
  const words = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  const cjk = (text.match(/[㐀-䶿一-鿿豈-﫿]/g) ?? []).length;
  const characters = Array.from(text).length;
  const lines = text ? text.split('\n').length : 0;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
  const readingMinutes = Math.max(1, Math.ceil((words + cjk) / 300));

  return { words: words + cjk, characters, lines, paragraphs, readingMinutes };
}
