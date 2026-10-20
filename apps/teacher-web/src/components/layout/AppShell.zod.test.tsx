// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("P11: teacher-web AppShell bundles no zod in shared shell", () => {
  it("does not statically import DateOfBirthPrompt in AppShell.tsx", () => {
    const file = path.join(__dirname, "AppShell.tsx");
    const source = fs.readFileSync(file, "utf8");

    // Static import brings DateOfBirthPrompt -> validators/auth -> zod into the shared chunk
    const hasStaticImport = /^import\s+\{[^}]*DateOfBirthPrompt[^}]*\}\s+from/m.test(source);
    expect(hasStaticImport, "AppShell.tsx must not statically import DateOfBirthPrompt").toBe(false);

    // Dynamic import loads DateOfBirthPrompt on-demand only when needsDateOfBirth is true
    const hasDynamicImport = /dynamic\(\s*\(\)\s*=>\s*import\(/m.test(source);
    expect(hasDynamicImport, "AppShell.tsx must dynamically import DateOfBirthPrompt via next/dynamic").toBe(true);
  });
});
