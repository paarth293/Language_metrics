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

/**
 * Strip all HTML tags from `input`, returning plain text.
 *
 * Runs the tag-strip pass repeatedly until the string stops changing, so
 * malformed/nested markup designed to survive a single pass (for example
 * `<<script>alert(1)<</script>>`, which a non-iterative
 * `str.replace(/<[^>]*>/g, "")` would only partially clean) is fully
 * removed too.
 */
export function stripHtml(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  let out = String(input);

  let previous: string;
  do {
    previous = out;
    out = out.replace(/<[^>]*>/g, "");
  } while (out !== previous);

  // Once the loop above is stable, no "<...>" pattern remains — so any
  // leftover "<" or ">" is a stray, unmatched bracket (e.g. from malformed
  // input like "<<script>x<</script>>", where the innermost ">" has no
  // partner left after its enclosing tag was stripped). Drop those too,
  // rather than leaving a bare ">" in the output.
  out = out.replace(/[<>]/g, "");

  return out.trim();
}

/**
 * Convenience helper: sanitize `value`, and if the result is empty, return
 * `fallback` instead (mirrors the `t.bio || fallback` pattern already used
 * across the discover/teacher routes).
 */
export function sanitizeOrFallback(
  value: string | null | undefined,
  fallback: string
): string {
  const cleaned = stripHtml(value);
  return cleaned.length > 0 ? cleaned : fallback;
}
