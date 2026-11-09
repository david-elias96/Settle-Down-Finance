// Renders the Settle Down logo into app icon, splash and Android assets.
// Run from the repo root: node scripts/render-brand-assets.js $PWD/assets (needs Playwright).
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const P = {
  light: { bg:'#1F5B3F', fg:'#F3F7EF', leaf:'#8FD19E', glow:'#F6C04E' },
  dark:  { bg:'#0D1712', fg:'#D9EBDD', leaf:'#4FA866', glow:'#F2B544' },
  mono:  { bg:'#000000', fg:'#FFFFFF', leaf:'#FFFFFF', glow:'#FFFFFF' },
  tint:  { bg:'#000000', fg:'#FFFFFF', leaf:'#B8B8B8', glow:'#D6D6D6' },
};
// House with cloud tree and a calm face. Drawn on a 1024 grid.
const glyph = c => `<g transform="translate(-18,-60)">
 <g fill="none" stroke="${c.fg}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round">
  <path d="M232 800V540L420 372L608 540V800"/><path d="M180 800H880"/>
  <path d="M374 684Q420 724 466 684" stroke-width="26"/>
  <path d="M338 604Q370 634 402 604" stroke-width="26"/><path d="M438 604Q470 634 502 604" stroke-width="26"/>
 </g>
 <circle cx="338" cy="662" r="18" fill="${c.glow}"/><circle cx="502" cy="662" r="18" fill="${c.glow}"/>
 <g transform="translate(36,0)">
  <path d="M720 560V800" stroke="${c.fg}" stroke-width="52" stroke-linecap="round"/>
  <g fill="${c.leaf}"><circle cx="720" cy="350" r="72"/><circle cx="660" cy="418" r="72"/><circle cx="782" cy="418" r="72"/><circle cx="634" cy="500" r="62"/><circle cx="806" cy="500" r="62"/><circle cx="720" cy="486" r="88"/></g>
 </g>
</g>`;
// scale: glyph spans roughly 154..922 x 264..766; s scales about the center.
const svg = (c, {bg=true, s=1}={}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg?`<rect width="1024" height="1024" fill="${c.bg}"/>`:''}<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${glyph(c)}</g></svg>`;
const jobs = [
  ['brand/logo-light.svg', svg(P.light), 0],
  ['brand/logo-dark.svg', svg(P.dark), 0],
  ['brand/logo-mark.svg', svg(P.light,{bg:false}), 0],
  ['images/icon.png', svg(P.light), 1024],
  ['images/icon-dark.png', svg(P.dark,{bg:false}), 1024],
  ['images/icon-tinted.png', svg(P.tint), 1024],
  ['images/splash-icon.png', svg(P.light,{bg:false}), 1024],
  ['images/splash-icon-dark.png', svg(P.dark,{bg:false}), 1024],
  ['images/android-icon-foreground.png', svg(P.light,{bg:false,s:0.62}), 512],
  ['images/android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${P.light.bg}"/></svg>`, 512],
  ['images/android-icon-monochrome.png', svg(P.mono,{bg:false,s:0.62}), 432],
  ['images/favicon.png', svg(P.light), 48],
];
(async()=>{
  const b = await chromium.launch();
  for (const [f, s, px] of jobs) {
    const dest = out + '/' + f;
    if (!px) { fs.writeFileSync(dest, s + '\n'); continue; }
    const p = await b.newPage({ viewport:{ width:px, height:px }, deviceScaleFactor:1 });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${s}`);
    await p.screenshot({ path: dest, omitBackground: true });
    await p.close();
  }
  await b.close();
})();
