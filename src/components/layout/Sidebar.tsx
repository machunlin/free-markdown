import { useMemo } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { extractHeadings } from '../../utils/markdownHeadings';
export function Sidebar() {
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const headings = useMemo(() => extractHeadings(activeTab?.content ?? ''), [activeTab?.content]);

  const jumpToHeading = (line: number) => {
    window.dispatchEvent(new CustomEvent('freemarkdown:jump-to-line', { detail: { line } }));
  };

  return (
    <aside className="w-60 flex-shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border)] flex flex-col" aria-label="Document outline">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">文档大纲</h2>
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)] truncate">{activeTab?.title ?? '未打开文档'}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2" aria-label="标题导航">
        {headings.map((heading) => (
          <button
            key={`${heading.line}-${heading.text}`}
            type="button"
            onClick={() => jumpToHeading(heading.line)}
            className="w-full text-left px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] truncate"
            style={{ paddingLeft: `${12 + (heading.level - 1) * 12}px` }}
            title={heading.text}
          >
            {heading.text}
          </button>
        ))}
        {headings.length === 0 && <p className="px-4 py-4 text-[12px] text-[var(--text-tertiary)]">当前文档暂无标题</p>}
      </nav>
    </aside>
  );
}
