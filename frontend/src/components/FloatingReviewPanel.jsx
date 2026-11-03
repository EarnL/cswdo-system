import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './FloatingReviewPanel.css';

const clampPosition = ({ x, y }) => ({
  x: Math.max(12, Math.min(x, window.innerWidth - 68)),
  y: Math.max(12, Math.min(y, window.innerHeight - 68)),
});

export default function FloatingReviewPanel({ children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(() => clampPosition({ x: window.innerWidth - 80, y: window.innerHeight - 88 }));
  const triggerRef = useRef(null);
  const [size, setSize] = useState({ width: 380, height: 560 });
  const resizeRef = useRef(null);
  const closeRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClick = useRef(false);

  const panelWidth = Math.min(size.width, window.innerWidth - 24);
  const height = Math.min(size.height, window.innerHeight - 24);
  const rightSpace = window.innerWidth - position.x - 56 - 24;
  const leftSpace = position.x - 24;
  const beside = Math.max(rightSpace, leftSpace) >= panelWidth;
  const growRight = rightSpace >= leftSpace;
  const growDown = position.y + 28 < window.innerHeight / 2;
  const panelLeft = beside
    ? (growRight ? position.x + 68 : position.x - panelWidth - 12)
    : Math.max(12, Math.min(growRight ? position.x : position.x + 56 - panelWidth, window.innerWidth - panelWidth - 12));
  const preferredTop = beside
    ? (growDown ? position.y : position.y + 56 - height)
    : (growDown ? position.y + 68 : position.y - height - 12);
  const panelTop = Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12));
  const resizePanel = (width, nextHeight) => setSize({
    width: Math.max(Math.min(300, window.innerWidth - 24), Math.min(width, window.innerWidth - 24)),
    height: Math.max(Math.min(280, window.innerHeight - 24), Math.min(nextHeight, window.innerHeight - 24)),
  });

  useEffect(() => {
    const resize = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return createPortal(
    <>
      <section
        id="staff-review-summary"
        aria-labelledby="staff-review-summary-title"
        inert={!open}
        aria-hidden={!open}
        className={`floating-review-window fixed z-40 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl ${open ? 'is-open' : ''}`}
        style={{
          top: panelTop,
          left: panelLeft,
          width: panelWidth,
          height,
          transformOrigin: `${position.x + 28 - panelLeft}px ${position.y + 28 - panelTop}px`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-7 py-3">
          <h2 id="staff-review-summary-title" className="font-black text-slate-900">Review Summary</h2>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close review summary" className="rounded-lg px-3 py-2 text-xl text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">{children}</div>
        <div className="shrink-0 border-t border-slate-200 px-7 py-2 text-center text-xs text-slate-500">Drag the corner to resize</div>
        <button
          type="button"
          aria-label="Resize review summary"
          title="Drag to resize, or use arrow keys"
          className="absolute z-20 flex h-6 w-6 touch-none items-center justify-center rounded bg-slate-200 text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          style={{
            [growRight ? 'right' : 'left']: 0,
            [growDown ? 'bottom' : 'top']: 0,
            cursor: growRight === growDown ? 'nwse-resize' : 'nesw-resize',
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            resizeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: panelWidth, height, growRight, growDown };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = resizeRef.current;
            if (!start || start.id !== event.pointerId) return;
            resizePanel(start.width + (event.clientX - start.x) * (start.growRight ? 1 : -1), start.height + (event.clientY - start.y) * (start.growDown ? 1 : -1));
          }}
          onPointerUp={() => { resizeRef.current = null; }}
          onPointerCancel={() => { resizeRef.current = null; }}
          onLostPointerCapture={() => { resizeRef.current = null; }}
          onKeyDown={(event) => {
            const movement = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
            if (!movement) return;
            event.preventDefault();
            resizePanel(panelWidth + movement[0], height + movement[1]);
          }}
        ><span aria-hidden="true">⤢</span></button>
      </section>
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Collapse review summary' : 'Open review summary'}
        aria-expanded={open}
        aria-controls="staff-review-summary"
        aria-describedby="staff-review-move-help"
        title="Review summary — drag to move"
        className="fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-[#0f4b94] text-white shadow-xl ring-2 ring-white hover:bg-[#0b3b76] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        style={{ left: position.x, top: position.y, cursor: 'move' }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          suppressClick.current = false;
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.hypot(dx, dy) > 6) suppressClick.current = true;
          if (suppressClick.current) setPosition(clampPosition({ x: drag.position.x + dx, y: drag.position.y + dy }));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; suppressClick.current = true; }}
        onLostPointerCapture={() => { dragRef.current = null; }}
        onClick={(event) => {
          if (suppressClick.current && event.detail !== 0) {
            suppressClick.current = false;
            return;
          }
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          const movement = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
          if (!movement) return;
          event.preventDefault();
          setPosition((current) => clampPosition({ x: current.x + movement[0], y: current.y + movement[1] }));
        }}
      >
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H5v16h14V5h-4M9 3h6v4H9zM8 12l2 2 4-4M8 18h8" />
        </svg>
      </button>
      <span id="staff-review-move-help" className="sr-only">Drag to move, or use arrow keys when focused. Press Enter to toggle the review summary.</span>
    </>,
    document.body,
  );
}
