/**
 * A pretend streaming service for trying the cancel agent safely (and for tests).
 * It has the usual obstacles: a login wall, a buried cancel link, a discount offer,
 * and an exit survey.
 */
export const PRACTICE_SITE_URL = 'https://practice.settledownfinancial.com/';

export const PRACTICE_SITE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StreamCo account</title>
<style>
  body { font: 16px -apple-system, system-ui, sans-serif; margin: 0; background: #111; color: #eee; }
  header { padding: 14px 18px; background: #e50914; font-weight: 800; letter-spacing: .5px; }
  main { padding: 20px 18px; display: grid; gap: 14px; }
  h1 { font-size: 22px; margin: 0; }
  .card { background: #1d1d1d; border-radius: 10px; padding: 16px; display: grid; gap: 10px; }
  button { font: inherit; padding: 12px; border-radius: 8px; border: 0; background: #e50914; color: #fff; font-weight: 600; }
  button.ghost { background: transparent; color: #bbb; text-decoration: underline; font-weight: 400; padding: 6px; }
  input, select { font: inherit; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #000; color: #fff; }
  label { display: grid; gap: 6px; font-size: 14px; color: #bbb; }
  .muted { color: #999; font-size: 14px; }
  .offer { border: 2px solid #f5c518; }
</style></head><body>
<header>STREAMCO</header>
<main id="app"></main>
<script>
var state = { step: 'login' };
var views = {
  login: function () { return '<h1>Sign in</h1><div class="card">' +
    '<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username">' +
    '<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password">' +
    '<button onclick="signIn()">Sign in</button><p class="muted">Practice site: type anything to sign in.</p></div>'; },
  account: function () { return '<h1>Account</h1>' +
    '<div class="card"><b>Membership & billing</b><span class="muted">Premium plan · $22.99/month · Next bill Dec 8 · card ending [number]</span>' +
    '<button class="ghost" onclick="go(\\'plan\\')">Change plan</button><button class="ghost" onclick="go(\\'manage\\')">Manage membership</button></div>' +
    '<div class="card"><b>Profile</b><span class="muted">Parental controls, language, subtitles</span></div>'; },
  plan: function () { return '<h1>Change plan</h1><div class="card"><button onclick="go(\\'account\\')">Upgrade to Ultra ($29.99)</button>' +
    '<button class="ghost" onclick="go(\\'account\\')">Back to account</button></div>'; },
  manage: function () { return '<h1>Manage membership</h1><div class="card"><span>Premium plan</span>' +
    '<button onclick="go(\\'account\\')">Keep watching</button><button class="ghost" onclick="go(\\'offer\\')">Cancel membership</button></div>'; },
  offer: function () { return '<h1>Before you go…</h1><div class="card offer"><b>Stay for 50% off for 3 months</b>' +
    '<span class="muted">Only $11.49/month. Offer ends today.</span><button onclick="go(\\'account\\')">Claim 50% off</button>' +
    '<button class="ghost" onclick="go(\\'survey\\')">No thanks, continue to cancel</button></div>'; },
  survey: function () { return '<h1>Why are you leaving?</h1><div class="card"><label for="reason">Reason</label>' +
    '<select id="reason"><option>Choose one</option><option>Too expensive</option><option>Not watching enough</option><option>Other</option></select>' +
    '<button onclick="if(document.getElementById(\\'reason\\').selectedIndex){go(\\'confirm\\')}else{alert(\\'Choose a reason\\')}">Continue</button></div>'; },
  confirm: function () { return '<h1>Finish cancellation</h1><div class="card"><span>Your membership will end on Dec 8. You won\\'t be charged again.</span>' +
    '<button onclick="go(\\'done\\')">Finish cancellation</button><button class="ghost" onclick="go(\\'account\\')">Go back</button></div>'; },
  done: function () { return '<h1>Membership cancelled</h1><div class="card"><span>Confirmation SC-48213. You can keep watching until Dec 8. We emailed a receipt to [email].</span></div>'; }
};
function go(step) { state.step = step; render(); window.scrollTo(0, 0); }
function signIn() { if (document.getElementById('pw').value) go('account'); else alert('Enter your password'); }
function render() { document.getElementById('app').innerHTML = views[state.step](); document.title = 'StreamCo · ' + state.step; }
render();
</script></body></html>`;
