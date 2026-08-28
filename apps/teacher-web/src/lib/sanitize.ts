/**
 * src/lib/sanitize.ts — HTML sanitization utilities
 *
 * Prevents XSS when interpolating user-controlled values into HTML
 * (e.g. email templates). All user-supplied strings MUST pass through
 * escapeHtml() before being embedded in any HTML context.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes HTML special characters in a string to prevent XSS.
 *
 * Replaces: & < > " '
 *
 * @example
 *   escapeHtml('<script>alert("xss")</script>')
 *   // → '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char);
}
