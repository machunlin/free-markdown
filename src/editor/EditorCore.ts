import { EditorView, keymap, placeholder, drawSelection, highlightActiveLine, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { closeBrackets } from '@codemirror/autocomplete';
import { searchKeymap } from '@codemirror/search';
import { scrollSyncExtension } from './extensions/scrollSync';
import { freeMarkdownKeymap } from './extensions/keymap';

export interface EditorCoreOptions {
  parent: HTMLElement;
  initialValue?: string;
  dark?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  tabSize?: number;
  onUpdate?: (content: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onScroll?: (scrollTop: number) => void;
}

export class EditorCore {
  view: EditorView;
  private readonly extensions: Extension[];
  private onUpdate?: (content: string) => void;
  private onCursorChange?: (line: number, column: number) => void;
  private onScroll?: (scrollTop: number) => void;
  private suppressUpdates = false;

  constructor(options: EditorCoreOptions) {
    this.onUpdate = options.onUpdate;
    this.onCursorChange = options.onCursorChange;
    this.onScroll = options.onScroll;
    this.extensions = [
      markdown({ base: markdownLanguage }),
      drawSelection(),
      highlightActiveLine(),
      EditorView.updateListener.of((update) => {
        if (this.suppressUpdates) return;
        if (update.docChanged) this.onUpdate?.(update.state.doc.toString());
        const position = update.state.selection.main.head;
        const line = update.state.doc.lineAt(position);
        this.onCursorChange?.(line.number - 1, position - line.from);
      }),
      options.wordWrap === false ? [] : EditorView.lineWrapping,
      placeholder('Start writing…'),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      history({ minDepth: 1000 }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      closeBrackets(),
      scrollSyncExtension((scrollTop) => {
        if (!this.suppressUpdates) this.onScroll?.(scrollTop);
      }),
      freeMarkdownKeymap,
      options.dark ? oneDark : [],
    ];

    if (options.lineNumbers !== false) {
      this.extensions.push(lineNumbers(), highlightActiveLineGutter());
    }
    if (options.fontFamily) {
      this.extensions.push(EditorView.theme({
        '&': { fontFamily: options.fontFamily },
        '.cm-content': { fontSize: `${options.fontSize ?? 14}px` },
      }));
    }

    this.view = new EditorView({
      state: this.createState(options.initialValue ?? ''),
      parent: options.parent,
    });
  }

  createState(content: string): EditorState {
    return EditorState.create({ doc: content, extensions: this.extensions });
  }

  getState(): EditorState {
    return this.view.state;
  }

  setState(state: EditorState): void {
    this.suppressUpdates = true;
    this.view.setState(state);
    this.suppressUpdates = false;
  }

  getValue(): string { return this.view.state.doc.toString(); }

  setValue(content: string): void {
    if (content === this.getValue()) return;
    this.suppressUpdates = true;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
      annotations: [],
    });
    this.suppressUpdates = false;
  }

  getCursor(): { line: number; column: number } {
    const position = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(position);
    return { line: line.number - 1, column: position - line.from };
  }

  getScrollTop(): number { return this.view.scrollDOM.scrollTop; }
  setScrollTop(top: number): void { this.view.scrollDOM.scrollTop = top; }
  focus(): void { this.view.focus(); }
  destroy(): void { this.view.destroy(); }

  getSelection(): string {
    const { from, to } = this.view.state.selection.main;
    return this.view.state.sliceDoc(from, to);
  }

  replaceSelection(text: string): void {
    this.view.dispatch(this.view.state.replaceSelection(text));
  }

  undo(): boolean { return undo(this.view); }
  redo(): boolean { return redo(this.view); }
}
