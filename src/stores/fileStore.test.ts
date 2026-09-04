import { describe, expect, it, beforeEach } from 'vitest';
import { useFileStore } from './fileStore';

const reset = () => useFileStore.setState({ tabs: [], activeTabId: null, recentFiles: [], closedTabs: [] });

describe('fileStore', () => {
  beforeEach(reset);

  it('creates, updates, reorders, and closes tabs', () => {
    const first = useFileStore.getState().createNewTab();
    const second = useFileStore.getState().createNewTab();
    useFileStore.getState().updateTabContent(first, '# Draft');
    useFileStore.getState().reorderTabs(1, 0);
    expect(useFileStore.getState().tabs[0]?.id).toBe(second);
    useFileStore.getState().closeTab(second);
    expect(useFileStore.getState().closedTabs[0]?.id).toBe(second);
    expect(useFileStore.getState().reopenClosedTab()).toBe(second);
  });

  it('does not create more than twenty tabs', () => {
    for (let index = 0; index < 21; index += 1) useFileStore.getState().createNewTab();
    expect(useFileStore.getState().tabs).toHaveLength(20);
  });
});
