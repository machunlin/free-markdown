import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { getDocumentStats } from '../../utils/wordCount';

export function StatusBar() {
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const mode = useEditorStore((state) => state.mode);

  if (!activeTab) return <div className="flex items-center px-3 py-0.5 h-6 bg-[var(--bg-elevated)] border-t border-[var(--border)] text-[11px] text-[var(--text-tertiary)] flex-shrink-0">No file open</div>;

  const stats = getDocumentStats(activeTab.content);
  const cursor = activeTab.cursor;
  return (
    <div className="flex items-center gap-4 px-3 py-0.5 h-6 bg-[var(--bg-elevated)] border-t border-[var(--border)] text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
      <span>Ln {cursor.line + 1}, Col {cursor.column + 1}</span>
      <span>Lines: {stats.lines}</span>
      <span>Words: {stats.words}</span>
      <span>Chars: {stats.characters}</span>
      <span>Reading: {stats.readingMinutes} min</span>
      <span className="text-[var(--text-secondary)]">{activeTab.encoding}</span>
      <span>{activeTab.isDirty ? '● Modified' : '✓ Saved'}</span>
      <div className="flex-1" />
      <span className="text-[var(--text-secondary)]">{mode === 'source' ? 'Source' : mode === 'split' ? 'Split' : 'Preview'}</span>
      {activeTab.path && <span className="truncate max-w-[200px]">{activeTab.path}</span>}
    </div>
  );
}
