import { createHash } from 'node:crypto';

function normalize(bullet: string): string {
  return bullet
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim()
    .replace(/^[-*]\s+/, '');
}

export function hashBullet(bullet: string): string {
  return createHash('sha256').update(normalize(bullet)).digest('hex').slice(0, 16);
}
