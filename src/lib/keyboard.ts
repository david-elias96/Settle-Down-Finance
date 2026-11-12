/**
 * How far to scroll so a field sits between `visibleTop` and `visibleBottom`, with `extraBelow`
 * points under it when there's room (for the button that follows). Positive scrolls content up.
 */
export function scrollShift({ fieldTop, fieldBottom, visibleTop, visibleBottom, extraBelow = 0 }: {
  fieldTop: number; fieldBottom: number; visibleTop: number; visibleBottom: number; extraBelow?: number;
}) {
  if (fieldTop < visibleTop) return fieldTop - visibleTop;
  const want = fieldBottom + extraBelow - visibleBottom;
  if (want <= 0) return 0;
  // Never push the field's own top above the visible area.
  return Math.min(want, fieldTop - visibleTop);
}
