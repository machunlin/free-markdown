import { useCallback, useEffect, useRef, useState } from 'react';
import { useFileStore } from '../../stores/fileStore';

export function TabBar() {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTab = useFileStore((state) => state.setActiveTab);
  const closeTab = useFileStore((state) => state.closeTab);
  const reorderTabs = useFileStore((state) => state.reorderTabs);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  const closeRequested = useCallback((tabId: string) => {
    const tab = useFileStore.getState().tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (tab.isDirty) setPendingCloseId(tabId);
    else closeTab(tabId);
  }, [closeTab]);

  useEffect(() => {
    const handleCloseEvent = (event: Event) => {
      const tabId = (event as CustomEvent<{ tabId?: string }>).detail?.tabId;
      if (tabId) closeRequested(tabId);
    };
    window.addEventListener('freemarkdown:close', handleCloseEvent);
    return () => window.removeEventListener('freemarkdown:close', handleCloseEvent);
  }, [closeRequested]);

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (dragIdx === null || dragIdx === index) return;
    reorderTabs(dragIdx, index);
    setDragIdx(index);
  };

  return (
    <div className="flex items-center bg-[var(--bg-elevated)] border-b border-[var(--border)] h-[38px] flex-shrink-0 overflow-x-auto">
      {tabs.map((tab, index) => (
        <div key={tab.id} ref={(element) => { tabRefs.current[index] = element; }} draggable onDragStart={() => setDragIdx(index)} onDragOver={(event) => handleDragOver(event, index)} onDragEnd={() => setDragIdx(null)} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-3 py-1 h-full text-[13px] cursor-pointer select-none border-r border-[var(--border)] whitespace-nowrap min-w-0 max-w-[200px] ${tab.id === activeTabId ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
          <span className="truncate flex-1">{tab.isDirty && '● '}{tab.title}</span>
          <button aria-label={`Close ${tab.title}`} onClick={(event) => { event.stopPropagation(); closeRequested(tab.id); }} className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bg-active)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">×</button>
        </div>
      ))}
      <div className="flex-1 h-full" />
      {pendingCloseId && <CloseDialog tabId={pendingCloseId} onCancel={() => setPendingCloseId(null)} onDiscard={(id) => { closeTab(id); setPendingCloseId(null); }} />}
    </div>
  );
}

interface CloseDialogProps {
  tabId: string;
  onCancel: () => void;
  onDiscard: (tabId: string) => void;
}

function CloseDialog({ tabId, onCancel, onDiscard }: CloseDialogProps) {
  const tab = useFileStore((state) => state.tabs.find((item) => item.id === tabId));
  if (!tab) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" role="presentation">
      <div className="w-80 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="close-dialog-title">
        <h2 id="close-dialog-title" className="text-[15px] font-semibold">保存对“{tab.title}”的修改？</h2>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">如果不保存，您的修改将会丢失。</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-secondary" onClick={() => onDiscard(tabId)}>不保存</button>
          <button className="btn-primary" onClick={() => { window.dispatchEvent(new CustomEvent('freemarkdown:save')); onCancel(); }}>保存</button>
        </div>
      </div>
    </div>
  );
}
