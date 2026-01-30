export default function DeviceCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse space-y-3">
      <div className="h-4 w-1/2 bg-muted rounded" />
      <div className="h-3 w-3/4 bg-muted rounded" />
      <div className="flex justify-between mt-4">
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="h-3 w-12 bg-muted rounded" />
      </div>
    </div>
  );
}
