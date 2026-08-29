import { expect, it } from 'vitest';

import { websiteContentTableScrollLeft } from './website-content-table-scroll';

it('supports explicit keyboard horizontal scrolling', () => {
  expect(websiteContentTableScrollLeft(0, 500, 'ArrowRight')).toBe(80);
  expect(websiteContentTableScrollLeft(80, 500, 'ArrowLeft')).toBe(0);
  expect(websiteContentTableScrollLeft(160, 500, 'End')).toBe(500);
  expect(websiteContentTableScrollLeft(160, 500, 'Home')).toBe(0);
  expect(websiteContentTableScrollLeft(160, 500, 'Tab')).toBeNull();
});
