/**
 * Next.js calls register() once when a server instance starts. A bad
 * environment fails the boot here instead of on the first request (#31).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOnBoot } = await import("./env");
    validateEnvOnBoot();
  }
}
