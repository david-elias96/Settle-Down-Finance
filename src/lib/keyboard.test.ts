import { describe, expect, it } from 'vitest';
import { scrollShift } from './keyboard';

// A phone: visible area between y=100 (under the header) and y=450 (above keyboard + Done bar).
const view = { visibleTop: 100, visibleBottom: 450 };

describe('scrollShift', () => {
  it('leaves a field that is already visible with room below', () => {
    expect(scrollShift({ ...view, fieldTop: 200, fieldBottom: 250, extraBelow: 72 })).toBe(0);
  });

  it('scrolls a field hidden behind the keyboard up, with room for the button', () => {
    expect(scrollShift({ ...view, fieldTop: 600, fieldBottom: 650, extraBelow: 72 })).toBe(272);
  });

  it('never pushes the field above the header to make room for the button', () => {
    // Field nearly fills the visible area: only scroll until its top reaches the header.
    expect(scrollShift({ ...view, fieldTop: 150, fieldBottom: 440, extraBelow: 72 })).toBe(50);
  });

  it('scrolls down to a field above the visible area', () => {
    expect(scrollShift({ ...view, fieldTop: 40, fieldBottom: 90 })).toBe(-60);
  });
});
