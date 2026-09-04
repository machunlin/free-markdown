import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';
import { createHighlighter, type Highlighter } from 'shiki';
import type { MarkdownCompat } from '../types';

export interface RenderOptions {
  compatibility?: MarkdownCompat;
  allowHtml?: boolean;
  breaks?: boolean;
  linkify?: boolean;
  typographer?: boolean;
}

export class RenderPipeline {
  private readonly md: MarkdownIt;

  constructor(options: RenderOptions = {}) {
    const compatibility = options.compatibility ?? 'gfm';
    this.md = new MarkdownIt({
      html: options.allowHtml ?? false,
      breaks: options.breaks ?? false,
      linkify: options.linkify ?? true,
      typographer: options.typographer ?? true,
    });

    if (compatibility !== 'strict') {
      this.md.enable(['table', 'strikethrough']);
      this.md.renderer.rules.s_del_open = () => '<del>';
      this.md.renderer.rules.s_del_close = () => '</del>';
    }
    if (compatibility === 'gfm' || compatibility === 'extended') this.md.use(taskLists);

    const defaultImageRender = this.md.renderer.rules.image ??
      ((tokens, index, renderOptions, _env, self) => self.renderToken(tokens, index, renderOptions));
    this.md.renderer.rules.image = (tokens, index, renderOptions, env, self) => {
      const token = tokens[index];
      if (!token) return '';
      token.attrSet('loading', 'lazy');
      return defaultImageRender(tokens, index, renderOptions, env, self);
    };

    const defaultLinkRender = this.md.renderer.rules.link_open ??
      ((tokens, index, renderOptions, _env, self) => self.renderToken(tokens, index, renderOptions));
    this.md.renderer.rules.link_open = (tokens, index, renderOptions, env, self) => {
      const token = tokens[index];
      if (!token) return '';
      const href = token.attrGet('href');
      if (href && /^(https?):\/\//i.test(href)) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
      }
      return defaultLinkRender(tokens, index, renderOptions, env, self);
    };
  }

  render(markdown: string): string {
    const rendered = this.md.render(markdown);
    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'a', 'img', 'em', 'strong', 'del', 'input', 'label', 'span', 'div',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'loading',
        'type', 'checked', 'disabled', 'colspan', 'rowspan', 'aria-hidden', 'aria-label',
      ],
    });
  }
}

let defaultPipeline: RenderPipeline | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
const HIGHLIGHT_LANGUAGES = ['javascript', 'typescript', 'json', 'bash', 'python', 'rust', 'css', 'html', 'markdown'];

async function getCodeHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: HIGHLIGHT_LANGUAGES,
  });
  return highlighterPromise;
}

export async function highlightCodeBlocks(html: string, dark: boolean): Promise<string> {
  if (!html.includes('<pre><code')) return html;
  const highlighter = await getCodeHighlighter();
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (!pre) return;
    const language = Array.from(code.classList)
      .find((name) => name.startsWith('language-'))?.slice('language-'.length) ?? 'text';
    if (!HIGHLIGHT_LANGUAGES.includes(language)) return;
    const highlighted = highlighter.codeToHtml(code.textContent ?? '', {
      lang: language,
      theme: dark ? 'github-dark' : 'github-light',
    });
    const highlightedContainer = document.createElement('template');
    highlightedContainer.innerHTML = highlighted;
    const highlightedPre = highlightedContainer.content.firstElementChild;
    if (!highlightedPre) return;
    highlightedPre.classList.add('markdown-code-block');
    const copyButton = document.createElement('button');
    copyButton.className = 'code-copy-button';
    copyButton.type = 'button';
    copyButton.textContent = 'Copy';
    copyButton.setAttribute('aria-label', `Copy ${language} code`);
    highlightedPre.append(copyButton);
    pre.replaceWith(highlightedPre);
  });
  return DOMPurify.sanitize(container.innerHTML, {
    ADD_TAGS: ['button'],
    ADD_ATTR: ['type'],
  });
}
export function getRenderPipeline(options?: RenderOptions): RenderPipeline {
  if (!options && !defaultPipeline) defaultPipeline = new RenderPipeline();
  return options ? new RenderPipeline(options) : defaultPipeline as RenderPipeline;
}
