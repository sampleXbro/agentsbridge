/**
 * Redact `user:password@` userinfo from any URLs embedded in a message so
 * tokens (GitHub PATs, GitLab OAuth2 tokens, etc.) never reach stdout/stderr
 * via error wrappers, log lines, or thrown error messages.
 *
 * Use anywhere a string that may contain a credential-bearing URL is about
 * to be logged or surfaced (`logger.warn(redactUrlSecrets(err.message))`).
 */

// Match `<scheme>://<userinfo>@<host…>` where the URL ends at whitespace, a
// quote, or end of string. Userinfo is non-empty and may contain `:`. We
// trim a single trailing punctuation character (`.,;:!?`) so URLs in prose
// like "failed: https://u:p@h/r.git." still get redacted cleanly.
const URL_WITH_CREDENTIALS = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s"'<>]+)@([^\s"'<>]+)/g;

export function redactUrlSecrets(message: string): string {
  return message.replace(
    URL_WITH_CREDENTIALS,
    (_full, scheme: string, _userinfo: string, rest: string) => {
      return `${scheme}***@${rest}`;
    },
  );
}
