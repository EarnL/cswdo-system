import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getPendingRequests, subscribeToRequests } from '../requestActivity';

export default function GlobalLoadingIndicator() {
  const pending = useSyncExternalStore(subscribeToRequests, getPendingRequests);
  const busy = pending > 0;
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const visibility = setTimeout(() => setVisible(busy), busy ? 150 : 200);
    const reminder = busy ? setTimeout(() => setSlow(true), 10000) : null;
    if (!busy) setSlow(false);
    return () => { clearTimeout(visibility); clearTimeout(reminder); };
  }, [busy]);
  if (!visible) return null;
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]">
    <div className="h-1 bg-blue-100"><div className="h-full w-full animate-pulse bg-[#0f4b94] motion-reduce:animate-none" /></div>
    <div role="status" aria-live="polite" aria-atomic="true" className="mx-auto mt-4 flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
      <svg aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-[#0f4b94] motion-reduce:animate-none" viewBox="0 0 24 24" fill="none"><circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" /><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      <span className="text-sm font-semibold text-slate-700">{slow ? 'Still working. Please wait…' : 'Loading, please wait…'}</span>
    </div>
  </div>;
}
