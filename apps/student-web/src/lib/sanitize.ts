/**
 * lib/sanitize.ts — dependency-free plaintext sanitizer for user-generated
 * content returned from student-web's API routes (teacher bios, review
 * comments, chat messages, etc.).
 *
 * Why hand-rolled instead of the `sanitize-html` package the audit
 * recommended: this project's local `node_modules` has not been installed
 * (verified — there is no `node_modules` directory anywhere in the repo on
 * disk), and this session has no working path to the npm registry either
 * (every `npm install`/`npm view` attempt here returns 403, blocked by the
 * sandbox's outbound policy). Shipping an `import sanitizeHtml from
 * "sanitize-html"` would silently break the build the moment anyone tried to
 * compile this app, until they separately ran `npm install sanitize-html
 * @types/sanitize-html`. This module needs zero new dependencies, so the fix
 * works the instant it lands — see errors.md for the full explanation and
 * the (optional) upgrade path to `sanitize-html` once `npm install` has been
 * run at least once.
 *
 * stripHtml() removes every HTML tag from a string, leaving plain text. It
 * does not attempt to allow-list any tags — every field this is used on
 * (teacher bios, review comments) is a plain-text field in this product, not
 * a rich-text field, so there is nothing legitimate to preserve.
 */

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
