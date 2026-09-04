import { useCallback, useRef, useState } from 'react';
import { useFileStore } from '../../stores/fileStore';

export function TabBar() {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTab = useFileStore((state) => state.setActiveTab);
  const closeTab = useFileStore((state) => state.closeTab);
  const reorderTabs = useFileStore((state) => state.reorderTabs);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleClose = useCallback((event: React.MouseEvent, tabId: string) => {
    event.stopPropagation();
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab?.isDirty || window.confirm(`"${tab.title}" has unsaved changes. Close anyway?`)) {
      closeTab(tabId);
    }
  }, [tabs, closeTab]);

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (dragIdx === null || dragIdx === index) return;
    reorderTabs(dragIdx, index);
    setDragIdx(index);
  };

  return (
    <div className="flex items-center bg-[var(--bg-elevated)] border-b border-[var(--border)] h-9 flex-shrink-0 overflow-x-auto">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          ref={(element) => { tabRefs.current[index] = element; }}
          draggable
          onDragStart={() => setDragIdx(index)}
          onDragOver={(event) => handleDragOver(event, index)}
          onDragEnd={() => setDragIdx(null)}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1 h-full text-xs cursor-pointer select-none border-r border-[var(--border)] whitespace-nowrap min-w-0 max-w-[200px] ${tab.id === activeTabId ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
        >
          <span className="truncate flex-1">{tab.isDirty && '● '}{tab.title}</span>
          <button aria-label={`Close ${tab.title}`} onClick={(event) => handleClose(event, tab.id)} className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center hover:bg-[var(--bg-active)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">×</button>
        </div>
      ))}
      <div className="flex-1 h-full" />
    </div>
  );
}
