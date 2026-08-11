import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin accessibility color tokens', () => {
  it('keeps muted light-theme text at WCAG AA contrast', () => {
    expect(contrast('#77757e', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['primary', '#5146b6', '#e9e7fd'],
    ['success', '#14733d', '#dcf7e8'],
    ['info', '#006c79', '#d6f4f8'],
    ['warning', '#884600', '#fff0e1'],
    ['danger', '#a7262b', '#ffe3e3'],
  ])('keeps the light %s badge above WCAG AA contrast', (_tone, foreground, background) => {
    expect(globalsCss).toContain(foreground);
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['primary', '#b8b1ff', '#3a3b64'],
    ['success', '#62dc93', '#2e4b4f'],
    ['info', '#43d9eb', '#27495f'],
    ['warning', '#ffb269', '#504448'],
    ['danger', '#ff9b9e', '#50374a'],
  ])('keeps the dark %s badge above WCAG AA contrast', (_tone, foreground, background) => {
    expect(globalsCss).toContain(foreground);
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red!) + (0.7152 * green!) + (0.0722 * blue!);
}
