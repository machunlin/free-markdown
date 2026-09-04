import { useFileStore } from '../../stores/fileStore';

export function Breadcrumb() {
  const activeTab = useFileStore((s) => {
    if (!s.activeTabId) return undefined;
    return s.tabs.find((t) => t.id === s.activeTabId);
  });

  if (!activeTab?.path) return null;

  const segments = activeTab.path.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border-b border-[var(--border)] overflow-x-auto">
      <span className="text-[var(--text-secondary)]">/</span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className={i === segments.length - 1 ? 'text-[var(--text-primary)] font-medium' : ''}>
            {seg}
          </span>
          {i < segments.length - 1 && <span className="text-[var(--text-tertiary)]">/</span>}
        </span>
      ))}
    </div>
  );
}
