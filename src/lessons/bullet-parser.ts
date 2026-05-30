export interface ParsedBullet {
  text: string;
  lineNumber: number;
}

export function parseBullets(markdown: string): ParsedBullet[] {
  const bullets: ParsedBullet[] = [];
  let current: ParsedBullet | null = null;
  let lineNumber = 0;

  for (const line of markdown.split('\n')) {
    lineNumber += 1;
    if (/^[-*]\s+/.test(line)) {
      if (current !== null) bullets.push(current);
      current = { text: line, lineNumber };
    } else if (current !== null) {
      if (line.length === 0) {
        bullets.push(current);
        current = null;
      } else if (/^\s+\S/.test(line)) {
        current.text += `\n${line}`;
      } else {
        bullets.push(current);
        current = null;
      }
    }
  }
  if (current !== null) bullets.push(current);
  return bullets;
}
