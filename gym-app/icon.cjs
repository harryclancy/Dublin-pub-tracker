const { chromium } = require('playwright');
const fs = require('fs');
process.chdir(__dirname);
const D = '../public/gym/';
const fontB64 = fs.readFileSync(D + 'fonts/BarlowCondensed-700.woff2').toString('base64');
// Dumbbell mark on a deep cobalt tile — no text so it reads at any size
const glyph = (s) => `<svg viewBox="0 0 100 100" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <g fill="#fff">
    <rect x="12" y="36" width="9" height="28" rx="3"/><rect x="22" y="28" width="11" height="44" rx="3.5"/>
    <rect x="79" y="36" width="9" height="28" rx="3"/><rect x="67" y="28" width="11" height="44" rx="3.5"/>
    <rect x="33" y="46" width="34" height="8" rx="2"/>
  </g></svg>`;
const tile = (size, pad, radius) => `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:radial-gradient(120% 120% at 20% 0%, #4C74FF 0%, #2344C8 55%, #152C8C 100%);display:grid;place-items:center;overflow:hidden;position:relative">
  <div style="position:absolute;right:-${size*0.28}px;top:-${size*0.28}px;width:${size*0.9}px;height:${size*0.9}px;border-radius:50%;border:${size*0.1}px solid rgba(255,255,255,.07)"></div>
  <div style="position:relative;filter:drop-shadow(0 ${size*0.02}px ${size*0.03}px rgba(0,0,0,.25))">${glyph(size * (1 - pad * 2))}</div></div></body></html>`;
const splash = (w, h) => `<html><head><style>@font-face{font-family:B;src:url(data:font/woff2;base64,${fontB64})}</style></head><body style="margin:0;width:${w}px;height:${h}px;background:#0D0F13;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${w*0.05}px">
  <div style="width:${w*0.26}px;height:${w*0.26}px;border-radius:${w*0.06}px;background:radial-gradient(120% 120% at 20% 0%, #4C74FF 0%, #2344C8 55%, #152C8C 100%);display:grid;place-items:center">${glyph(w*0.2)}</div>
  <div style="font:700 ${w*0.085}px B;letter-spacing:.02em;color:#EDEFF3;text-transform:uppercase">Gym</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const shot = async (html, w, h, path, omit) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.waitForTimeout(100); await p.screenshot({ path, omitBackground: !!omit }); await p.close(); };
  // iOS applies its own rounded mask, so the apple icon is a full square
  await shot(tile(180, 0.16, 0), 180, 180, D + 'icons/apple-touch-icon.png');
  await shot(tile(192, 0.16, 0), 192, 192, D + 'icons/icon-192.png');
  await shot(tile(512, 0.16, 0), 512, 512, D + 'icons/icon-512.png');
  await shot(tile(512, 0.26, 0), 512, 512, D + 'icons/maskable-512.png');
  await shot(tile(64, 0.14, 14), 64, 64, D + 'icons/favicon.png', true);
  await shot(tile(1024, 0.16, 225), 1024, 1024, '/tmp/icon-preview.png', true);
  const sizes = [[1320,2868,440,956,3],[1206,2622,402,874,3],[1290,2796,430,932,3],[1179,2556,393,852,3],[1284,2778,428,926,3],[1170,2532,390,844,3],[1080,2340,360,780,3],[1242,2688,414,896,3],[1125,2436,375,812,3],[828,1792,414,896,2],[1242,2208,414,736,3],[750,1334,375,667,2],[640,1136,320,568,2]];
  const links = [];
  for (const [w, h, cw, ch, r] of sizes) {
    const f = `splash/${w}x${h}.png`;
    await shot(splash(w, h), w, h, D + f);
    links.push(`<link rel="apple-touch-startup-image" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="${f}">`);
  }
  fs.writeFileSync('splash-links.html', links.join('\n'));
  await b.close();
})();
