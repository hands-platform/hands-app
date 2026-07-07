import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin surface CSS', () => {
  it('keeps AdminCardGrid on the Vuexy card group rhythm', () => {
    const gridIndex = globalsCss.indexOf('.admin-card-grid {');
    const gridBlock = cssRuleBlockAt(gridIndex);

    expect(gridIndex).toBeGreaterThan(-1);
    expect(gridBlock).toContain('display: grid');
    expect(gridBlock).toContain('gap: 14px');
    expect(gridBlock).toContain('min-width: 0');
  });

  it('keeps AdminSection footers on the Vuexy CardActions row rhythm', () => {
    const footerIndex = globalsCss.indexOf('.admin-section-footer {');
    const footerBlock = cssRuleBlockAt(footerIndex);

    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerBlock).toContain('border-top: 1px solid var(--admin-border)');
    expect(footerBlock).toContain('padding-top: 14px');
    expect(footerBlock).toContain('align-items: center');
    expect(footerBlock).toContain('display: flex');
    expect(footerBlock).toContain('flex-wrap: wrap');
    expect(footerBlock).toContain('gap: 12px');
    expect(footerBlock).toContain('justify-content: space-between');
    expect(footerBlock).not.toContain('display: grid');
  });

  it('keeps AdminSection and AdminCardHeader actions on the Vuexy CardHeader action slot rhythm', () => {
    const actionIndex = globalsCss.indexOf('.admin-section-actions,');
    const actionBlock = cssRuleBlockAt(actionIndex);
    const pillIndex = globalsCss.indexOf('.admin-section-actions > .pill,');
    const pillBlock = cssRuleBlockAt(pillIndex);

    expect(actionIndex).toBeGreaterThan(-1);
    expect(actionBlock).toContain('.admin-card-header-actions');
    expect(actionBlock).toContain('align-items: center');
    expect(actionBlock).toContain('display: flex');
    expect(actionBlock).toContain('flex-wrap: wrap');
    expect(actionBlock).toContain('gap: 8px');
    expect(actionBlock).toContain('justify-content: flex-end');
    expect(actionBlock).toContain('margin-top: 0');
    expect(actionBlock).toContain('min-width: 0');
    expect(pillIndex).toBeGreaterThan(actionIndex);
    expect(pillBlock).toContain('flex-shrink: 0');
  });

  it('keeps AdminState panels on the Vuexy Alert rhythm', () => {
    const stateIndex = globalsCss.indexOf('.admin-state {');
    const stateBlock = cssRuleBlockAt(stateIndex);
    const stateIconIndex = globalsCss.indexOf('.admin-state-icon {');
    const stateIconBlock = cssRuleBlockAt(stateIconIndex);
    const infoIndex = globalsCss.indexOf('.admin-state-info {');
    const infoBlock = cssRuleBlockAt(infoIndex);
    const dangerIndex = globalsCss.indexOf('.admin-state-danger {');
    const dangerBlock = cssRuleBlockAt(dangerIndex);

    expect(stateIndex).toBeGreaterThan(-1);
    expect(stateBlock).toContain('gap: 16px');
    expect(stateBlock).toContain('grid-template-columns: 30px minmax(0, 1fr)');
    expect(stateBlock).toContain('padding: 12px 16px');
    expect(stateBlock).not.toContain('grid-template-columns: 40px minmax(0, 1fr)');
    expect(stateBlock).not.toContain('padding: 18px');
    expect(stateIconIndex).toBeGreaterThan(-1);
    expect(stateIconBlock).toContain('height: 30px');
    expect(stateIconBlock).toContain('width: 30px');
    expect(stateIconBlock).not.toContain('height: 40px');
    expect(stateIconBlock).not.toContain('width: 40px');
    expect(infoIndex).toBeGreaterThan(stateIconIndex);
    expect(infoBlock).toContain('background: var(--admin-info-soft)');
    expect(infoBlock).toContain('border-color: rgb(var(--admin-info-channel) / 0.24)');
    expect(infoBlock).toContain('color: var(--admin-info-text)');
    expect(dangerIndex).toBeGreaterThan(infoIndex);
    expect(dangerBlock).toContain('background: var(--admin-danger-soft)');
    expect(dangerBlock).toContain('border-color: rgb(var(--admin-danger-channel) / 0.24)');
    expect(dangerBlock).toContain('color: var(--admin-danger-text)');
  });

  it('keeps loading state icons visibly animated for Vuexy async feedback', () => {
    const loadingIconIndex = globalsCss.indexOf('.admin-loading-state .admin-state-icon svg {');
    const loadingIconBlock = cssRuleBlockAt(loadingIconIndex);
    const keyframesIndex = globalsCss.indexOf('@keyframes admin-state-spin {');

    expect(loadingIconIndex).toBeGreaterThan(-1);
    expect(loadingIconBlock).toContain('animation: admin-state-spin 0.8s linear infinite');
    expect(loadingIconBlock).toContain('transform-origin: center');
    expect(keyframesIndex).toBeGreaterThan(loadingIconIndex);
  });

  it('keeps shared notices on the Vuexy Alert icon and spacing rhythm', () => {
    const inlineIndex = globalsCss.indexOf('.admin-inline-notice {');
    const inlineBlock = cssRuleBlockAt(inlineIndex);
    const inlineIconIndex = globalsCss.indexOf('.admin-inline-notice-icon {');
    const inlineIconBlock = cssRuleBlockAt(inlineIconIndex);
    const cardIndex = globalsCss.indexOf('.admin-notice-card {');
    const cardBlock = cssRuleBlockAt(cardIndex);
    const cardIconIndex = globalsCss.indexOf('.admin-notice-card-icon {');
    const cardIconBlock = cssRuleBlockAt(cardIconIndex);

    expect(inlineBlock).toContain('grid-template-columns: 30px minmax(0, 1fr)');
    expect(inlineBlock).toContain('gap: 16px');
    expect(inlineIconBlock).toContain('height: 30px');
    expect(inlineIconBlock).toContain('width: 30px');
    expect(cardBlock).toContain('grid-template-columns: 30px minmax(0, 1fr)');
    expect(cardBlock).toContain('gap: 16px');
    expect(cardIconBlock).toContain('height: 30px');
    expect(cardIconBlock).toContain('width: 30px');
  });

  it('keeps framed empty states on the Vuexy raised surface rhythm', () => {
    const emptyIndex = globalsCss.indexOf('.empty-state {');
    const emptyBlock = cssRuleBlockAt(emptyIndex);
    const titleIndex = globalsCss.indexOf('.empty-state strong {');
    const titleBlock = cssRuleBlockAt(titleIndex);
    const messageIndex = globalsCss.indexOf('.empty-state .muted {');
    const messageBlock = cssRuleBlockAt(messageIndex);

    expect(emptyIndex).toBeGreaterThan(-1);
    expect(emptyBlock).toContain('background: var(--admin-surface-raised)');
    expect(emptyBlock).toContain('border: 1px solid var(--admin-border)');
    expect(emptyBlock).toContain('box-shadow: var(--admin-shadow-xs)');
    expect(emptyBlock).toContain('display: grid');
    expect(emptyBlock).toContain('gap: 4px');
    expect(emptyBlock).toContain('padding: 16px');
    expect(emptyBlock).not.toContain('background: var(--admin-primary-soft)');
    expect(emptyBlock).not.toContain('border: 1px dashed');
    expect(emptyBlock).not.toContain('min-height: 92px');
    expect(titleIndex).toBeGreaterThan(emptyIndex);
    expect(titleBlock).toContain('color: var(--admin-text)');
    expect(titleBlock).toContain('font-size: 0.9375rem');
    expect(titleBlock).toContain('line-height: 1.35');
    expect(messageIndex).toBeGreaterThan(titleIndex);
    expect(messageBlock).toContain('font-size: 0.8125rem');
    expect(messageBlock).toContain('line-height: 1.45');
    expect(messageBlock).toContain('margin: 0');
  });

  it('keeps shared disclosures on the Vuexy Accordion rhythm', () => {
    const disclosureIndex = globalsCss.indexOf('.admin-disclosure {');
    const disclosureBlock = cssRuleBlockAt(disclosureIndex);
    const openIndex = globalsCss.indexOf('.admin-disclosure[open] {');
    const openBlock = cssRuleBlockAt(openIndex);
    const summaryIndex = globalsCss.indexOf('.admin-disclosure > summary {');
    const summaryBlock = cssRuleBlockAt(summaryIndex);

    expect(disclosureIndex).toBeGreaterThan(-1);
    expect(disclosureBlock).toContain('box-shadow: var(--admin-shadow-xs)');
    expect(openIndex).toBeGreaterThan(-1);
    expect(openBlock).toContain('box-shadow: var(--admin-shadow-md)');
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(summaryBlock).toContain('align-items: center');
    expect(summaryBlock).toContain('color: var(--admin-text)');
    expect(summaryBlock).toContain('display: flex');
    expect(summaryBlock).toContain('gap: 8px');
    expect(summaryBlock).toContain('min-height: 46px');
    expect(summaryBlock).toContain('padding: 12px 20px 12px 24px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
