import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';

interface FloatingOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
}

export default function FloatingOverlay({ onClose, children, initialX, initialY }: FloatingOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [pos, setPos] = useState({
    x: initialX ?? Math.max(window.innerWidth - 420, 0),
    y: initialY ?? 24,
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const OVERLAY_W = 400;
  const OVERLAY_H = isMinimized ? 48 : 580;

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
      const newY = Math.max(0, Math.min(window.innerHeight - 48, me.clientY - offset.current.y));
      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pos, OVERLAY_W]);

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
        transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
          padding: '10px 14px',
          background: 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)',
          color: 'white',
          cursor: 'grab',
          flexShrink: 0,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          minHeight: 48,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>JD Scan</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isMinimized
              ? <Maximize2 style={{ width: 14, height: 14 }} />
              : <Minimize2 style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
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
