// Access tokens expire after 15 minutes and the proxy only refreshes them on
// page navigations, so a page left open that long gets a 401. Refresh once and retry.

let refreshing: Promise<boolean> | null = null;

/**
 * One refresh at a time: the refresh route rotates the session and treats a
 * reused refresh token as theft, so parallel refreshes would sign the user out.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then((res) => res.ok, () => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function fetchWithRefresh(input: string, init?: RequestInit) {
  const res = await fetch(input, { credentials: "include", ...init });
  if (res.status !== 401) return res;
  return (await refreshSession()) ? fetch(input, { credentials: "include", ...init }) : res;
}
