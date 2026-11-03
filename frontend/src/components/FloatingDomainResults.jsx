import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SIZE = 56;
const GAP = 12;
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const clamp = (position, bounds) => ({
  x: Math.max(GAP, Math.min(position.x, bounds.width - SIZE - GAP)),
  y: Math.max(GAP, Math.min(position.y, bounds.height - SIZE - GAP)),
});

export default function FloatingDomainResults({ answered, total, children }) {
  const [bounds, setBounds] = useState(viewport);
  const [position, setPosition] = useState(() => clamp({ x: window.innerWidth - 76, y: window.innerHeight - 100 }, viewport()));
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const button = useRef(null);
  const panelId = useId();
  const hintId = useId();

  useEffect(() => {
    const resize = () => {
      const next = viewport();
      setBounds(next);
      setPosition(current => clamp(current, next));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const escape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);

  const startDrag = event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = event => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 6) return;
    start.moved = true;
    suppressClick.current = true;
    setDragging(true);
    setPosition(clamp({ x: start.position.x + dx, y: start.position.y + dy }, bounds));
  };
  const endDrag = event => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const width = Math.min(336, bounds.width - GAP * 2);
  const spaceAbove = position.y - GAP * 2;
  const spaceBelow = bounds.height - position.y - SIZE - GAP * 2;
  const above = spaceAbove >= spaceBelow;
  const panelStyle = {
    position: 'fixed',
    width,
    left: Math.max(GAP, Math.min(position.x + SIZE - width, bounds.width - width - GAP)),
    maxHeight: Math.max(0, above ? spaceAbove : spaceBelow),
    ...(above ? { bottom: bounds.height - position.y + GAP } : { top: position.y + SIZE + GAP }),
  };

  // Portal keeps the control fixed to the viewport even inside animated page layouts.
  return createPortal(<div className="print:hidden">
    <span id={hintId} className="sr-only">Drag to move, or use arrow keys while focused. Press Enter to open or collapse results.</span>
    <button ref={button} type="button" aria-label="Domain Results" aria-describedby={hintId} aria-expanded={open} aria-controls={open ? panelId : undefined}
      title="Domain Results — drag to move" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onClick={event => { if (!suppressClick.current || event.detail === 0) setOpen(current => !current); }}
      onKeyDown={event => {
        const directions = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        setPosition(current => clamp({ x: current.x + direction[0], y: current.y + direction[1] }, bounds));
      }}
      className="fixed z-40 flex flex-col items-center justify-center rounded-full border-2 border-white bg-[#0f4b94] text-white shadow-lg outline-none hover:bg-[#0b3f7e] focus-visible:ring-4 focus-visible:ring-blue-300"
      style={{ left: position.x, top: position.y, width: SIZE, height: SIZE, touchAction: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab' }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 19V12M12 19V5M19 19V9" /></svg>
      <span aria-hidden="true" className="text-[10px] font-semibold leading-3">{answered}/{total}</span>
    </button>
    {open && <section id={panelId} aria-label="Domain Results" style={panelStyle} className="z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <div><h2 className="text-sm font-semibold text-[#0f4b94]">Domain Results</h2><p className="text-xs text-slate-500">{answered}/{total} answered</p></div>
        <button type="button" aria-label="Collapse domain results" onClick={() => { setOpen(false); button.current?.focus({ preventScroll: true }); }} className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-blue-700">−</button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4" aria-live="polite">{children}</div>
    </section>}
  </div>, document.body);
}
