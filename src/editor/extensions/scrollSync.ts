import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

export function scrollSyncExtension(onScroll: (scrollTop: number) => void) {
  return ViewPlugin.fromClass(
    class {
      private readonly view: EditorView;
      private readonly handleScroll: () => void;
      private frame = 0;

      constructor(view: EditorView) {
        this.view = view;
        this.handleScroll = () => {
          cancelAnimationFrame(this.frame);
          this.frame = requestAnimationFrame(() => onScroll(this.view.scrollDOM.scrollTop));
        };
        view.scrollDOM.addEventListener('scroll', this.handleScroll, { passive: true });
      }

      update(_update: ViewUpdate) {}

      destroy() {
        cancelAnimationFrame(this.frame);
        this.view.scrollDOM.removeEventListener('scroll', this.handleScroll);
      }
    },
  );
}
