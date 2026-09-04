import { describe, expect, it } from 'vitest';
import { RenderPipeline, highlightCodeBlocks } from './RenderPipeline';

describe('RenderPipeline', () => {
  it('highlights yaml and yml code blocks', async () => {
    const html = new RenderPipeline().render('```yml\nname: FreeMarkdown\n```');
    const highlighted = await highlightCodeBlocks(html, true);
    expect(highlighted).toContain('shiki');
  });

  it('renders GFM tables, tasks, and strikethrough', () => {
    const html = new RenderPipeline({ compatibility: 'gfm' }).render('| A |\n| - |\n| B |\n\n- [x] Done\n\n~~old~~');
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<p>old</p>');
  });

  it('sanitizes dangerous HTML and protocols', () => {
    const html = new RenderPipeline({ allowHtml: true }).render('<script>alert(1)</script> [bad](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });
});
