import { useEffect, useRef, useState } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeStore } from '../../stores/themeStore';
import { getRenderPipeline, highlightCodeBlocks } from '../../renderer/RenderPipeline';

interface ScrollEventDetail { source: 'editor' | 'preview'; ratio: number; }

const scrollRatio = (element: HTMLElement) => {
  const max = element.scrollHeight - element.clientHeight;
  return max > 0 ? Math.max(0, Math.min(1, element.scrollTop / max)) : 0;
};

export function PreviewPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);
  const syncingRef = useRef(false);
  const activeTab = useFileStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
  const settings = useSettingsStore((state) => state.settings);
  const theme = useThemeStore((state) => state.current);
  const appearance = useThemeStore((state) => state.appearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [html, setHtml] = useState('<p class="text-[var(--text-tertiary)]">Nothing to preview</p>');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

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
        try {
          const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
          const highlighted = await highlightCodeBlocks(rawHtml, dark);
          if (renderId === renderIdRef.current) setHtml(highlighted);
        } catch {
          if (renderId === renderIdRef.current) setHtml(rawHtml);
        }
      })();
    }, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeTab?.content, settings, appearance, systemDark, theme]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !activeTab) return;
    const max = element.scrollHeight - element.clientHeight;
    element.scrollTop = Math.min(activeTab.scrollPosition, Math.max(0, max));
  }, [activeTab]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      if (syncingRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent<ScrollEventDetail>('freemarkdown:scroll', {
          detail: { source: 'preview', ratio: scrollRatio(element) },
        }));
      });
    };
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<ScrollEventDetail>).detail;
      if (detail.source !== 'editor') return;
      const max = element.scrollHeight - element.clientHeight;
      syncingRef.current = true;
      element.scrollTop = detail.ratio * Math.max(0, max);
      requestAnimationFrame(() => { syncingRef.current = false; });
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('freemarkdown:scroll', onSync);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', onScroll);
      window.removeEventListener('freemarkdown:scroll', onSync);
    };
  }, []);

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
      <div className="markdown-preview" style={{ fontFamily: settings.previewFontFamily, fontSize: `${settings.previewFontSize}px`, lineHeight: settings.previewLineHeight, maxWidth: `${settings.previewMaxWidth}px` }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
