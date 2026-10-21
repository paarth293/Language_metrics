/**
 * Loading boundary for every route in the admin workspace.
 *
 * This used to render a dashboard-shaped skeleton — a page title, four metric
 * tiles and a 2:1 panel split — for every destination. Navigating to Teachers
 * or Audit Logs therefore flashed the shape of a page the admin had not asked
 * for before the real one arrived, which read as the app reloading into the
 * wrong view.
 *
 * It is now deliberately shape-neutral: a heading and a single content block,
 * which is true of every page in the section. Combined with the router cache
 * window in next.config.ts, a revisit inside that window skips this boundary
 * altogether.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-[1230px] px-6 pb-4 pt-2 max-[900px]:px-5 max-[640px]:px-4"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="lm-skeleton h-3 w-24 rounded-full" />
      <div className="lm-skeleton mt-4 h-10 w-72 rounded-xl" />
      <div className="lm-skeleton mt-3 h-4 w-[420px] max-w-full rounded-full" />
      <div className="lm-panel mt-8 h-[480px]" />
    </div>
  );
}
