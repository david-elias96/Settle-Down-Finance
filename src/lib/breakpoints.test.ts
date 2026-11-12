import { describe, expect, it } from 'vitest';
import { layoutFor } from './breakpoints';

describe('layoutFor', () => {
  it('keeps the phone layout in the iPhone app at any width', () => {
    expect(layoutFor('ios', 1366)).toEqual({ wide: false, sidebar: false });
  });
  it('uses a centered column on tablet-width browsers and a sidebar on desktop', () => {
    expect(layoutFor('web', 390)).toEqual({ wide: false, sidebar: false });
    expect(layoutFor('web', 800)).toEqual({ wide: true, sidebar: false });
    expect(layoutFor('web', 1440)).toEqual({ wide: true, sidebar: true });
  });
});
