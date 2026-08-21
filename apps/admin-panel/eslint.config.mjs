import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import securityPlugin from "eslint-plugin-security";
import noSecretsPlugin from "eslint-plugin-no-secrets";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ── Security rules ──────────────────────────────────────────────────────
  {
    plugins: {
      security: securityPlugin,
      "no-secrets": noSecretsPlugin,
    },
    rules: {
      // Detects potential ReDoS vulnerabilities
      "security/detect-unsafe-regex": "error",
      // Detects object injection via bracket notation
      "security/detect-object-injection": "warn",
      // Detects non-literal fs usage (path traversal risk)
      "security/detect-non-literal-fs-filename": "warn",
      // Detects eval-like patterns
      "security/detect-eval-with-expression": "error",
      // Detects pseudo-random number generators (use crypto.randomUUID instead)
      "security/detect-pseudoRandomBytes": "warn",
      // Detects child_process with non-literal command args
      "security/detect-child-process": "error",
      // Prevents disabling eslint-disable on security rules
      "security/detect-disable-mustache-escape": "warn",
      // Detects new Buffer() which is deprecated and can overflow
      "security/detect-new-buffer": "error",
      // Flags possible path traversal
      "security/detect-non-literal-require": "warn",

      // ── Additional auth/session hygiene rules ─────────────────────────
      // Disallow hardcoded secrets in any string literals
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.5,
          additionalRegexes: {
            "hardcoded-password": "password\\s*===\\s*['\"][^'\"]{4,}['\"]",
            "hardcoded-username": "username\\s*===\\s*['\"]admin['\"]",
            "static-session-value": "\\\.set\\(['\"][^'\"]+['\"],\\s*['\"]authenticated['\"]",
          },
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "security-tests/**",
  ]),
]);

export default eslintConfig;
