export interface DocumentHeading {
  level: number;
  text: string;
  line: number;
}

export function extractHeadings(markdown: string): DocumentHeading[] {
  return markdown.split('\n').flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    return match?.[1] && match[2]
      ? [{ level: match[1].length, text: match[2], line: index }]
      : [];
  });
}
