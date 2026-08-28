import { describe, it, expect } from "vitest";
import { escapeHtml } from "./sanitize";

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should escape less-than signs", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("should escape greater-than signs", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('value="xss"')).toBe("value=&quot;xss&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("should escape a full XSS payload", () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
  });

  it("should not alter safe strings", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
    expect(escapeHtml("john@example.com")).toBe("john@example.com");
    expect(escapeHtml("user123")).toBe("user123");
  });

  it("should handle empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should handle strings with only special characters", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#x27;");
  });

  it("should handle multiple occurrences of the same character", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });

  it("should preserve unicode characters", () => {
    expect(escapeHtml("Hello 👋 María")).toBe("Hello 👋 María");
  });
});
