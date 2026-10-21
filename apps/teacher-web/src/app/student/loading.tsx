/**
 * Loading boundary for the student section.
 *
 * Without one here, a navigation between student routes fell back to
 * app/loading.tsx — a boundary that sits *above* the AppShell, so the
 * sidebar, header and breadcrumb were all replaced by a full-screen spinner
 * on the way to the next page. This boundary is inside the shell, so only
 * the content area is ever covered.
 */
export default function StudentSectionLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-inset" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-inset" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-inset lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-inset" />
      </div>
    </div>
  );
}
