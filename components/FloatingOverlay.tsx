import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Minimize2, Maximize2, Settings } from 'lucide-react';

interface FloatingOverlayProps {
  onClose: () => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
}

export default function FloatingOverlay({ onClose, onOpenSettings, children, initialX, initialY }: FloatingOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [pos, setPos] = useState({
    x: initialX ?? Math.max(window.innerWidth - 420, 0),
    y: initialY ?? 24,
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const OVERLAY_W = Math.min(400, Math.max(280, window.innerWidth - 24));
  const OVERLAY_H = Math.min(isMinimized ? 40 : 580, Math.max(40, window.innerHeight - 24));

  useEffect(() => {
    const keepInViewport = () => {
      const width = Math.min(400, Math.max(280, window.innerWidth - 24));
      const height = Math.min(isMinimized ? 40 : 580, Math.max(40, window.innerHeight - 24));
      setPos(current => ({
        x: Math.max(0, Math.min(window.innerWidth - width, current.x)),
        y: Math.max(12, Math.min(window.innerHeight - height - 12, current.y)),
      }));
    };
    keepInViewport();
    window.addEventListener('resize', keepInViewport);
    return () => window.removeEventListener('resize', keepInViewport);
  }, [isMinimized]);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on the buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };

    const onMouseMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - OVERLAY_W, me.clientX - offset.current.x));
      const newY = Math.max(12, Math.min(window.innerHeight - OVERLAY_H - 12, me.clientY - offset.current.y));
      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pos, OVERLAY_W, OVERLAY_H]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: OVERLAY_W,
        height: OVERLAY_H,
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'var(--jd-shadow-overlay), 0 0 0 1px oklch(var(--jd-border))',
        background: 'oklch(var(--jd-background))',
        color: 'oklch(var(--jd-foreground))',
        fontFamily: 'var(--jd-font-sans)',
        userSelect: dragging.current ? 'none' : 'auto',
      }}
    >
      {/* Header / Drag Handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'oklch(var(--jd-card))',
          color: 'oklch(var(--jd-foreground))',
          borderBottom: '1px solid oklch(var(--jd-border))',
          cursor: 'grab',
          flexShrink: 0,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          height: 40,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              background: 'oklch(var(--jd-brand-100))',
              color: 'oklch(var(--jd-brand-700))',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>JD Scan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Settings"
              aria-label="Open settings"
              style={{ width: 32, height: 32, borderRadius: 6, background: 'transparent', border: 'none', color: 'oklch(var(--jd-foreground))', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'oklch(var(--jd-muted))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Settings aria-hidden="true" style={{ width: 14, height: 14 }} />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
            aria-label={isMinimized ? 'Expand assistant' : 'Minimize assistant'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'oklch(var(--jd-foreground))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'oklch(var(--jd-muted))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isMinimized
              ? <Maximize2 style={{ width: 14, height: 14 }} />
              : <Minimize2 style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close assistant"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'oklch(var(--jd-foreground))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'oklch(var(--jd-muted))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
      )}
    </div>
  );
}
