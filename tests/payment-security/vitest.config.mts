import { defineConfig, type Plugin } from "vitest/config";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Payment-security suite. Runs the real route handlers and settlement code
// against an in-memory database and a fake Cashfree sandbox (see harness/).

const root = fileURLToPath(new URL("../..", import.meta.url));
const apps = ["admin-panel", "teacher-web", "student-web"];

/**
 * Each app maps "@/" to its own src/. Resolve it by the importing file's app,
 * falling back to student-web for the tests themselves.
 */
function perAppAlias(): Plugin {
  return {
    name: "payment-security:per-app-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.startsWith("@/")) return null;
      const path = (importer ?? "").replaceAll("\\", "/");
      const app = apps.find((name) => path.includes(`/apps/${name}/`)) ?? "student-web";
      return this.resolve(join(root, "apps", app, "src", source.slice(2)), importer, { skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [perAppAlias()],
  test: {
    root,
    include: ["tests/payment-security/**/*.test.ts"],
    environment: "node",
  },
});
