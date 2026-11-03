import React from 'react';

function LoadingSpinner({ className = 'h-4 w-4' }) {
  return (
    <span
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent align-[-0.125em]`}
      aria-hidden="true"
    />
  );
}

function LoadingState({ title = 'Loading...', message = 'Please wait while the system prepares your data.', variant = 'card' }) {
  const wrapperClass = variant === 'inline'
    ? 'flex items-center gap-3 text-sm font-semibold text-slate-600'
    : 'rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm';

  return (
    <div className={wrapperClass} role="status" aria-live="polite">
      <LoadingSpinner className={variant === 'inline' ? 'h-4 w-4 text-[#0f4b94]' : 'mx-auto h-8 w-8 text-[#0f4b94]'} />
      <div className={variant === 'inline' ? '' : 'mt-3'}>
        <p className="font-black text-slate-800">{title}</p>
        {message ? <p className="mt-1 text-sm text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`motion-loading rounded-lg bg-slate-200/80 ${className}`} />;
}

function DashboardSkeleton({ cards = 4 }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="mt-3 h-8 w-72 max-w-full" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-4 h-8 w-20" />
            <SkeletonBlock className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-5 w-48" />
        <div className="mt-4 space-y-3">
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" role="status" aria-live="polite">
      <LoadingState title="Loading records..." message="Fetching the latest data." variant="inline" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <SkeletonBlock key={columnIndex} className="h-9 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { DashboardSkeleton, LoadingSpinner, LoadingState, SkeletonBlock, TableSkeleton };
