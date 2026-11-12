// Shared by webAlert.ts and webAlert.web.ts. Its own file (with no .web variant) so the web
// build can import it: in webAlert.web.ts, './webAlert' resolves back to itself, which left
// browserAlert undefined and made every Alert.alert in the web app throw.

export type Button = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/**
 * Plays an Alert.alert call through the browser's own dialogs: one button is a plain alert;
 * otherwise each non-cancel button is offered in turn with confirm(), and Cancel runs if none
 * is accepted.
 */
export function browserAlert(
  dialogs: { alert(msg: string): void; confirm(msg: string): boolean },
  title: string, message?: string, buttons?: Button[],
) {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const actions = list.filter((b) => b.style !== 'cancel');
  const cancel = list.find((b) => b.style === 'cancel');
  if (list.length === 1) { dialogs.alert(text); list[0].onPress?.(); return; }
  for (const b of actions) {
    const ask = actions.length === 1 ? text : `${text}\n\n${b.text ?? 'OK'}?`;
    if (dialogs.confirm(ask)) { b.onPress?.(); return; }
  }
  cancel?.onPress?.();
}
