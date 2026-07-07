import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin chat window CSS', () => {
  it('keeps chat empty states on the shared Vuexy empty-state rhythm', () => {
    const emptyIndex = globalsCss.indexOf('.admin-chat-empty-state {');
    const emptyBlock = cssRuleBlockAt(emptyIndex);

    expect(emptyIndex).toBeGreaterThan(-1);
    expect(emptyBlock).toContain('border: 1px dashed var(--admin-border)');
    expect(emptyBlock).toContain('border-radius: var(--admin-radius)');
    expect(emptyBlock).toContain('padding: 18px');
    expect(emptyBlock).toContain('text-align: center');
  });

  it('scopes chat transcript typography to direct Vuexy chat slots', () => {
    expect(globalsCss).toContain('.booking-chat-evidence-item > span');
    expect(globalsCss).toContain('.booking-chat-evidence-item > strong');
    expect(globalsCss).toContain('.booking-chat-evidence-item > p');
    expect(globalsCss).toContain('.admin-chat-contact > div > strong');
    expect(globalsCss).toContain('.admin-chat-contact > div > span');
    expect(globalsCss).toContain('.booking-chat-message > p');
    expect(globalsCss).toContain('.booking-chat-message-meta > strong');
    expect(globalsCss).toContain('.booking-chat-message-meta > time');
    expect(globalsCss).toContain('.chat-transcript-bubble > p');

    expect(globalsCss).not.toContain('.booking-chat-evidence-item span {');
    expect(globalsCss).not.toContain('.booking-chat-evidence-item strong {');
    expect(globalsCss).not.toContain('.booking-chat-evidence-item p {');
    expect(globalsCss).not.toContain(
      '.admin-chat-contact span:not(.admin-chat-contact-avatar):not(.admin-chat-contact-status)',
    );
    expect(globalsCss).not.toContain('.admin-chat-contact strong {');
    expect(globalsCss).not.toContain('.admin-chat-contact div > span {');
    expect(globalsCss).not.toContain('.booking-chat-message p {');
    expect(globalsCss).not.toContain('.booking-chat-message-meta strong {');
    expect(globalsCss).not.toContain('.booking-chat-message-meta time {');
    expect(globalsCss).not.toContain('.chat-transcript-bubble p {');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
