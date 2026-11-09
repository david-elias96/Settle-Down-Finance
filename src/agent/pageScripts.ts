/**
 * JavaScript injected into the in-app browser. `SNAPSHOT_JS` describes the page as text
 * for the agent; `actionJs` carries out one action. Both run on the phone. Typed values
 * are never read, and sensitive fields are marked so the agent can't fill them in.
 * Keep the sensitive-field rule in step with isSensitiveField in src/domain/cancelAgent.ts.
 */

export const SNAPSHOT_JS = `(function () {
  var SENSITIVE = /pass|pwd|card|cvv|cvc|csc|ssn|social|security.?code|routing|account.?number|pin\\b|otp|one.?time|verification.?code/i;
  var MAX = 150;
  function visible(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }
  function labelOf(el) {
    if (el.id) { var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return l.innerText; }
    var p = el.closest('label'); if (p) return p.innerText;
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '';
  }
  function clean(t) { return (t || '').replace(/\\s+/g, ' ').trim().slice(0, 120); }
  function redact(t) {
    return t.replace(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, '[email]').replace(/\\b(?:\\d[ -]?){6,}\\d\\b/g, '[number]');
  }
  document.querySelectorAll('[data-sdf]').forEach(function (e) { e.removeAttribute('data-sdf'); });
  var sel = 'a[href],button,input,select,textarea,[role=button],[role=link],[role=checkbox],[role=radio],[role=menuitem],[role=tab],[role=switch],summary';
  var els = [], n = 0, hasPassword = false;
  document.querySelectorAll(sel).forEach(function (el) {
    if (els.length >= MAX || !visible(el)) return;
    var tag = el.tagName.toLowerCase(), type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && type === 'hidden') return;
    var label = clean(labelOf(el));
    var isField = tag === 'input' || tag === 'textarea' || tag === 'select';
    var sensitive = isField && (type === 'password' ||
      /^(cc-|current-password|new-password|one-time-code)/.test(el.getAttribute('autocomplete') || '') ||
      SENSITIVE.test((el.getAttribute('name') || '') + ' ' + label));
    if (type === 'password') hasPassword = true;
    var id = String(++n);
    el.setAttribute('data-sdf', id);
    var d = { id: id, tag: tag, text: redact(isField ? label : clean(el.innerText || el.value || label)) };
    var role = el.getAttribute('role'); if (role) d.role = role;
    if (type) d.type = type;
    if (type === 'checkbox' || type === 'radio' || role === 'checkbox' || role === 'radio' || role === 'switch')
      d.checked = el.checked === true || el.getAttribute('aria-checked') === 'true';
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') d.disabled = true;
    if (sensitive) d.sensitive = true;
    if (tag === 'a') d.href = el.href;
    if (tag === 'select') d.options = Array.prototype.slice.call(el.options, 0, 20).map(function (o) { return clean(o.text); });
    els.push(d);
  });
  var text = redact((document.body ? document.body.innerText : '').replace(/\\n{2,}/g, '\\n')).slice(0, 4000);
  return JSON.stringify({ url: location.href, title: document.title, text: text, elements: els, hasPasswordField: hasPassword });
})()`;

type PageAction =
  | { kind: 'click'; elementId: string }
  | { kind: 'type'; elementId: string; text: string }
  | { kind: 'choose'; elementId: string; option: string }
  | { kind: 'scroll'; direction: 'up' | 'down' };

/** JS for one action. Returns "ok" or an error message string. */
export function actionJs(a: PageAction): string {
  const find = (id: string) => `document.querySelector('[data-sdf="${id.replace(/[^0-9]/g, '')}"]')`;
  switch (a.kind) {
    case 'click':
      return `(function(){var el=${find(a.elementId)};if(!el)return 'Element not found';el.scrollIntoView({block:'center'});el.click();return 'ok';})()`;
    case 'type':
      return `(function(){var el=${find(a.elementId)};if(!el)return 'Element not found';
        if(el.type==='password')return 'Refused: password field';
        var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(a.text)});
        el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()`;
    case 'choose':
      return `(function(){var el=${find(a.elementId)};if(!el||el.tagName!=='SELECT')return 'Not a dropdown';
        var want=${JSON.stringify(a.option.toLowerCase())};
        var o=Array.prototype.find.call(el.options,function(o){return o.text.trim().toLowerCase()===want;});
        if(!o)return 'Option not found';el.value=o.value;el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()`;
    case 'scroll':
      return `(function(){window.scrollBy(0,${a.direction === 'down' ? '' : '-'}Math.round(window.innerHeight*0.8));return 'ok';})()`;
  }
}
