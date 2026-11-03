import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ChartInsightModal = ({ insight, onClose }) => {
  const panel = useRef(null);
  const closeButton = useRef(null);
  useEffect(() => {
    if (!insight) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const buttons = panel.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [insight, onClose]);
  if (!insight) return null;

  const sections = [
    ['What This Graph Shows', insight.meaning],
    ['Selected Item Insight', insight.itemInsight],
    ['Important Findings', insight.findings],
    ['Methodology', insight.methodology],
    ['Period Covered', insight.period],
  ].filter(([, value]) => value);

  return createPortal(
    <div ref={panel} className="fixed inset-0 z-[9999] flex items-start justify-end bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={insight.title}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/20 bg-white shadow-[0_30px_90px_-42px_rgba(15,23,42,0.95)]">
        <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Details</p>
              <h2 className="mt-1 text-xl font-black">{insight.title}</h2>
              {insight.selectedLabel ? (
                <p className="mt-1 text-sm font-semibold text-white/70">
                  Selected: {insight.selectedLabel}{insight.selectedValue !== undefined ? ` | ${insight.selectedValue}` : ''}
                </p>
              ) : null}
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {sections.map(([label, value]) => (
            <section key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
              {Array.isArray(value) ? (
                <div className="mt-3 grid gap-2">
                  {value.map((item) => (
                    <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700">{item}</div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{value}</p>
              )}
            </section>
          ))}

          {insight.factors?.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Factors</p>
              <div className="mt-3 grid gap-2">
                {insight.factors.map((factor) => (
                  <div key={factor} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{factor}</div>
                ))}
              </div>
            </section>
          ) : null}

          {insight.actions?.length ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Recommended Actions</p>
              <div className="mt-3 grid gap-2">
                {insight.actions.map((action) => (
                  <div key={action} className="rounded-lg bg-white/80 px-3 py-2 text-sm font-bold text-emerald-900">{action}</div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>, document.body
  );
};

export default ChartInsightModal;
