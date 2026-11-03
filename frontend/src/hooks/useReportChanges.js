import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

export const leaveReportMessage = 'You have unsaved changes. Leave this report without saving?';

// BrowserRouter navigation and browser history both need protection.
export function installReportGuard(navigator, isDirty) {
  const originals = {};
  const allow = () => !isDirty() || window.confirm(leaveReportMessage);
  ['push', 'replace'].forEach(method => {
    originals[method] = navigator[method];
    navigator[method] = (...args) => {
      if (allow()) return originals[method].apply(navigator, args);
    };
  });
  let index = window.history.state?.idx;
  let restoring = false;
  const pop = event => {
    const next = event.state?.idx;
    if (restoring) {
      restoring = false;
      event.stopImmediatePropagation();
      return;
    }
    if (isDirty() && Number.isInteger(index) && Number.isInteger(next) && next !== index && !allow()) {
      event.stopImmediatePropagation();
      restoring = true;
      window.history.go(index - next);
      return;
    }
    index = next;
  };
  const unload = event => {
    if (isDirty()) { event.preventDefault(); event.returnValue = ''; }
  };
  window.addEventListener('popstate', pop, true);
  window.addEventListener('beforeunload', unload);
  return () => {
    Object.entries(originals).forEach(([method, original]) => { navigator[method] = original; });
    window.removeEventListener('popstate', pop, true);
    window.removeEventListener('beforeunload', unload);
  };
}

export default function useReportChanges(value, ready = true) {
  const snapshot = JSON.stringify(value);
  const [baseline, setBaseline] = useState(snapshot);
  const resetPending = useRef(false);
  const [resetVersion, setResetVersion] = useState(0);
  const acceptNextChange = useCallback(() => { resetPending.current = true; setResetVersion(version => version + 1); }, []);
  const resetBaseline = useCallback(nextValue => { setBaseline(JSON.stringify(nextValue)); }, []);
  const wasReady = useRef(ready);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const dirty = ready && wasReady.current && snapshot !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!ready || !wasReady.current || resetPending.current) {
      setBaseline(snapshot);
      resetPending.current = false;
    }
    wasReady.current = ready;
  }, [snapshot, ready, resetVersion]);
  useEffect(() => installReportGuard(navigator, () => dirtyRef.current), [navigator]);
  return {
    dirty,
    markSaved: () => setBaseline(snapshot),
    acceptNextChange,
    resetBaseline,
    confirmDiscard: () => !dirtyRef.current || window.confirm(leaveReportMessage),
  };
}
