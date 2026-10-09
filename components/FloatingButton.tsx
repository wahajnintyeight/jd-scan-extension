import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ScanLine } from 'lucide-react';

interface FloatingButtonProps {
  onClick: () => void;
  isExpanded: boolean;
}

export default function FloatingButton({ onClick, isExpanded }: FloatingButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: 24 });
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    hasDragged.current = false;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };

    const onMouseMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      hasDragged.current = true;
      const newX = Math.max(0, Math.min(window.innerWidth - 56, me.clientX - offset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 56, me.clientY - offset.current.y));
      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [pos]);

  const handleClick = () => {
    // Only trigger click if we didn't drag
    if (!hasDragged.current) {
      onClick();
    }
  };

  if (isExpanded) return null;

  return (
    <button
      ref={btnRef}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 2147483647,
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
      aria-label="Open JD Scan assistant"
      title="Open JD Scan assistant"
    >
      <div style={{ position: 'relative' }}>
        {/* Main Button */}
        <div
          style={{
            width: 56,
            height: 56,
            background: 'oklch(var(--jd-primary))',
            borderRadius: '50%',
            boxShadow: isHovered
              ? '0 4px 14px oklch(var(--jd-primary) / 0.3), 0 0 0 3px oklch(var(--jd-primary) / 0.15)'
              : '0 2px 8px oklch(var(--jd-primary) / 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          <ScanLine style={{ width: 26, height: 26, color: 'oklch(var(--jd-primary-foreground))' }} />
        </div>

        {/* Pulse ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'oklch(var(--jd-primary) / 0.2)',
            animation: 'jdscan-ping 2.4s cubic-bezier(0,0,0.2,1) infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Tooltip */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: 68,
              transform: 'translateY(-50%)',
              background: 'oklch(var(--jd-foreground))',
              color: 'oklch(var(--jd-background))',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
              boxShadow: 'var(--jd-shadow-tooltip)',
              pointerEvents: 'none',
              fontFamily: 'var(--jd-font-sans)',
            }}
          >
            Open JD Scan
            <div
              style={{
                position: 'absolute',
                right: -4,
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                width: 8,
                height: 8,
                background: 'oklch(var(--jd-foreground))',
              }}
            />
          </div>
        )}
      </div>

      {/* Inline keyframe for pulse */}
      <style>{`
        @keyframes jdscan-ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
