/**
 * Browser-side Sentry, only when NEXT_PUBLIC_SENTRY_DSN is set (#8). The SDK is
 * loaded on demand so pages carry no Sentry code when it is off.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("./sentry")]).then(([Sentry, { sentryOptions }]) => {
    Sentry.init(sentryOptions(dsn));
  });
}
