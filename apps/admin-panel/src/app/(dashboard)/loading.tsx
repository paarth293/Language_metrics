export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4" aria-busy="true" aria-label="Loading admin workspace">
      <div className="lm-skeleton h-3 w-24 rounded-full" />
      <div className="lm-skeleton mt-4 h-10 w-72 rounded-xl" />
      <div className="lm-skeleton mt-3 h-4 w-[420px] max-w-full rounded-full" />
      <div className="mt-8 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="lm-panel h-[122px] p-5"><div className="lm-skeleton h-3 w-28 rounded-full" /><div className="lm-skeleton mt-7 h-8 w-24 rounded-lg" /><div className="lm-skeleton mt-2 h-3 w-36 rounded-full" /></div>)}
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)] gap-5 max-[1080px]:grid-cols-1">
        <div className="lm-panel h-[420px]" />
        <div className="lm-panel h-[420px]" />
      </div>
    </div>
  );
}
