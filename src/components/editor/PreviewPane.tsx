import { useEffect, useRef, useState } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getRenderPipeline, highlightCodeBlocks } from '../../renderer/RenderPipeline';

export function PreviewPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const settings = useSettingsStore((state) => state.settings);
  const [html, setHtml] = useState('<p class="text-[var(--text-tertiary)]">Nothing to preview</p>');

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const renderId = ++renderIdRef.current;
    timerRef.current = setTimeout(() => {
      void (async () => {
        if (!activeTab?.content) {
          setHtml('<p class="text-[var(--text-tertiary)]">Nothing to preview</p>');
          return;
        }
        const rawHtml = getRenderPipeline({
          compatibility: settings.previewMarkdownMode,
          allowHtml: settings.previewAllowHtml,
          breaks: settings.markdownBreaks,
          linkify: settings.markdownLinkify,
          typographer: settings.markdownTypographer,
        }).render(activeTab.content);
        const highlighted = await highlightCodeBlocks(rawHtml, document.documentElement.classList.contains('dark'));
        if (renderId === renderIdRef.current) setHtml(highlighted);
      })();
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab?.content, settings]);

  useEffect(() => {
    if (!containerRef.current || !activeTab) return;
    const element = containerRef.current;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    if (scrollHeight > 0) element.scrollTop = Math.min(activeTab.scrollPosition, scrollHeight);
  }, [activeTab]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleCopy = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches('.code-copy-button')) return;
      const code = target.parentElement?.querySelector('code')?.textContent ?? '';
      void navigator.clipboard.writeText(code).then(() => {
        target.textContent = 'Copied';
        setTimeout(() => { target.textContent = 'Copy'; }, 1200);
      }).catch(() => { target.textContent = 'Copy failed'; });
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto bg-[var(--preview-bg)]">
      <div
        className="markdown-preview"
        style={{
          fontFamily: settings.previewFontFamily,
          fontSize: `${settings.previewFontSize}px`,
          lineHeight: settings.previewLineHeight,
          maxWidth: `${settings.previewMaxWidth}px`,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
