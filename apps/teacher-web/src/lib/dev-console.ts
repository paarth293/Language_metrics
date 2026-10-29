/**
 * Print to the terminal during local development only, for things that must
 * never reach production logs — e.g. an OTP code shown so a developer can
 * finish sign-up without an email provider (#8: never log OTPs).
 */
export function printForDevelopment(lines: string[]): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(["", "=".repeat(50), ...lines, "=".repeat(50), ""].join("\n"));
}
