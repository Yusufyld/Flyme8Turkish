// kullanım: node kirp.js <çıktı.png> <sayfa> <w> <h> <clip x,y,w,h> [AYAR json] [t]
const { chromium } = require('playwright');
(async () => { const [out, sayfa, w, h, clip, ayar, t] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, reducedMotion: 'reduce' }); const pg = await c.newPage();
  pg.on('console', m => { if (m.type() === 'error') console.log(m.text().slice(0, 300)); });
  await pg.goto((process.env.TABAN || 'http://127.0.0.1:8765/bekleyen/deniz2-v24/test/sayfa/') + sayfa); await pg.waitForTimeout(1200);
  await pg.evaluate(([a, t]) => { const s = Deniz2._durum(); if (a) Object.assign(Deniz2.AYAR, JSON.parse(a)); s.t = +t || 7.3; Deniz2.yenile(); }, [ayar, t]); await pg.waitForTimeout(500);
  const [x, y, cw, ch] = clip.split(',').map(Number); await pg.screenshot({ path: out, clip: { x, y, width: cw, height: ch } }); await b.close(); })();
