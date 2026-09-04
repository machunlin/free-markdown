import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

export function scrollSyncExtension(onScroll: (scrollTop: number) => void) {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        // Attach scroll listener
        view.scrollDOM.addEventListener('scroll', () => {
          onScroll(view.scrollDOM.scrollTop);
        });
      }
      update(_update: ViewUpdate) {
        // No-op; scroll is handled by the DOM event listener
      }
      destroy() {}
    }
  );
}
