import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Vuexy basic timeline CSS', () => {
  it('keeps HANDS timeline spacing aligned with Vuexy Timeline overrides', () => {
    const timelineBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-basic-timeline {'));
    const dotBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-basic-timeline-dot {'));
    const connectorBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-basic-timeline-connector {'));
    const contentBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-basic-timeline-content {'));
    const timeBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-basic-timeline-time {'));

    expect(timelineBlock).toContain('padding: 0');
    expect(timelineBlock).not.toContain('padding: 2px 0 0');
    expect(dotBlock).toContain('margin: 12px 0');
    expect(connectorBlock).toContain('width: 1px');
    expect(contentBlock).toContain('padding: 0 0 1rem 16px');
    expect(contentBlock).not.toContain('padding: 0 0 22px 12px');
    expect(timeBlock).toContain('white-space: nowrap');
    expect(timeBlock).toContain('font-size: 12px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
