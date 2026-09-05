/**
 * Markdown link destinations may percent-encode spaces and friends. Resolve
 * against the decoded path, then re-encode the rewritten link so it stays a
 * valid destination for the same file.
 */

export function decodeLinkPath(token: string, role: string): string {
  if (role !== 'markdown-link-dest' || !token.includes('%')) return token;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function encodeLinkPath(path: string, enabled: boolean): string {
  if (!enabled) return path;
  return path
    .split('/')
    .map((segment) =>
      segment === '' || segment === '.' || segment === '..' ? segment : encodeURIComponent(segment),
    )
    .join('/');
}
