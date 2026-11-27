// Genera los PNG de los íconos a partir de public/icons/icon.svg (requiere Playwright).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';
const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
for (const [n, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-512-maskable', 512, 60]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:#0A192F"><div style="padding:${pad}px">${svg.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body>`);
  await p.screenshot({ path: new URL(`../public/icons/${n}.png`, import.meta.url).pathname });
}
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:#0A192F;display:flex;align-items:center;justify-content:center;gap:48px;font-family:system-ui">
${svg.replace('<svg ', '<svg width="260" height="260" ')}
<div><div style="font-size:110px;font-weight:900;letter-spacing:-3px"><span style="color:#fff">Tambo</span><span style="color:#14B8D4">Alerta</span></div>
<div style="color:#CBD5E1;font-size:30px;letter-spacing:8px;font-weight:700">PREVENIR ES PROTEGER VIDAS</div>
<div style="color:#CBD5E1;font-size:26px;margin-top:28px">Mapa de calles inundables · Avisos SENAMHI · Reportes ciudadanos</div></div></body>`);
await p.screenshot({ path: new URL('../public/icons/og.png', import.meta.url).pathname });
await b.close();
