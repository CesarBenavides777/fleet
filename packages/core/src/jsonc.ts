/**
 * Parse JSON-with-comments. Strips whole-line `//` comments only, which leaves
 * inline URLs ("https://…") intact. Trailing commas are not supported — keep
 * config files clean.
 */
export function parseJsonc<T = unknown>(raw: string): T {
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as T;
}
