import { keymap, type KeyBinding } from '@codemirror/view';

export const freeMarkdownKeymap = keymap.of([
  {
    key: 'Mod-b',
    run: (view) => {
      const sel = view.state.selection.main;
      if (sel.empty) return false;
      const text = view.state.sliceDoc(sel.from, sel.to);
      view.dispatch(
        view.state.replaceSelection(`**${text}**`)
      );
      return true;
    },
  },
  {
    key: 'Mod-i',
    run: (view) => {
      const sel = view.state.selection.main;
      if (sel.empty) return false;
      const text = view.state.sliceDoc(sel.from, sel.to);
      view.dispatch(
        view.state.replaceSelection(`*${text}*`)
      );
      return true;
    },
  },
  {
    key: 'Mod-k',
    run: (view) => {
      const sel = view.state.selection.main;
      if (sel.empty) {
        view.dispatch(
          view.state.replaceSelection('[link text](url)')
        );
      } else {
        const text = view.state.sliceDoc(sel.from, sel.to);
        view.dispatch(
          view.state.replaceSelection(`[${text}](url)`)
        );
      }
      return true;
    },
  },
] as readonly KeyBinding[]);

export default freeMarkdownKeymap;
