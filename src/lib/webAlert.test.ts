import { describe, expect, it, vi } from 'vitest';
import { browserAlert } from './browserAlert';

const dialogs = (answers: boolean[] = []) => ({ alert: vi.fn(), confirm: vi.fn(() => answers.shift() ?? false) });

describe('browserAlert (web app dialogs)', () => {
  it('shows a plain alert and runs its only button', () => {
    const d = dialogs(); const ok = vi.fn();
    browserAlert(d, 'Bank connected', '2 accounts linked.', [{ text: 'OK', onPress: ok }]);
    expect(d.alert).toHaveBeenCalledWith('Bank connected\n\n2 accounts linked.');
    expect(ok).toHaveBeenCalled();
  });

  it('confirms a destructive action, or runs Cancel when declined', () => {
    const del = vi.fn(); const cancel = vi.fn();
    const buttons = [{ text: 'Cancel', style: 'cancel' as const, onPress: cancel }, { text: 'Delete', style: 'destructive' as const, onPress: del }];
    browserAlert(dialogs([true]), 'Delete account?', undefined, buttons);
    expect(del).toHaveBeenCalledOnce();
    browserAlert(dialogs([false]), 'Delete account?', undefined, buttons);
    expect(cancel).toHaveBeenCalledOnce();
    expect(del).toHaveBeenCalledOnce();
  });

  it('offers several choices one at a time', () => {
    const a = vi.fn(); const b = vi.fn(); const d = dialogs([false, true]);
    browserAlert(d, 'Pick', 'msg', [{ text: 'A', onPress: a }, { text: 'B', onPress: b }, { text: 'Cancel', style: 'cancel' }]);
    expect(d.confirm).toHaveBeenLastCalledWith('Pick\n\nmsg\n\nB?');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
