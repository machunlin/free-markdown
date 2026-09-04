import { useState, useCallback, useRef, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultRatio?: number;
  showDivider?: boolean;
}

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;

export function SplitPane({ left, right, defaultRatio = 0.5, showDivider = true }: SplitPaneProps) {
  const [ratio, setRatio] = useState(() => {
    const stored = localStorage.getItem('freemarkdown.splitRatio');
    const value = stored ? Number(stored) : defaultRatio;
    return Number.isFinite(value) ? Math.max(MIN_RATIO, Math.min(MAX_RATIO, value)) : defaultRatio;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = Math.max(MIN_RATIO, Math.min(MAX_RATIO, (moveEvent.clientX - rect.left) / rect.width));
      setRatio(next);
      localStorage.setItem('freemarkdown.splitRatio', String(next));
    };
    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!right) return <div className="flex-1 min-w-0">{left}</div>;
  if (!left) return <div className="flex-1 min-w-0">{right}</div>;

  return (
    <div ref={containerRef} className="flex-1 flex min-w-0">
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 overflow-hidden">{left}</div>
      {showDivider && <div role="separator" aria-label="Resize editor and preview" onMouseDown={handleMouseDown} className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize flex-shrink-0 transition-colors" />}
      <div style={{ width: `${(1 - ratio) * 100}%` }} className="min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}
