export default function RootLoading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
          <div
            className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-gold animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>
        <span className="text-sm text-text-muted font-medium">Loading...</span>
      </div>
    </div>
  );
}
