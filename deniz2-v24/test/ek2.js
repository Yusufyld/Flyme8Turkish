const { chromium } = require('playwright'); const out = process.argv[2];
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await c.newPage(); const m = [];
  pg.on('console', x => { if (x.type() === 'error') m.push(x.text().slice(0, 200)); }); pg.on('pageerror', e => m.push('ERR ' + e));
  await pg.goto('http://127.0.0.1:8765/test/gun.html'); await pg.waitForTimeout(2500);
  // 1) kalite kademeleri: her shader düzeyi derleniyor mu
  for (let i = 0; i < 6; i++) { const r = await pg.evaluate(async () => { const s = Deniz2._durum(); if (!s) return 'KAPANDI'; s.dusur(); await new Promise(r => setTimeout(r, 500)); const s2 = Deniz2._durum(); return s2 ? { adim: s2.adim, kalite: s2.kalite, K: s2.mat.defines.KALITE, cv: s2.cv.width + 'x' + s2.cv.height, prog: s2.renderer.info.programs.length, bozuk: s2.renderer.info.programs.some(p => p.diagnostics && p.diagnostics.runnable === false) } : 'KAPANDI'; }); console.log('kalite', JSON.stringify(r)); }
  await pg.screenshot({ path: out + '/dusuk-kalite.png', fullPage: true });
  // 2) boyut değişimi (telefonu çevirme / tablet)
  await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(900);
  console.log('yatay', JSON.stringify(await pg.evaluate(() => { const s = Deniz2._durum(); return s && { cv: s.cv.width + 'x' + s.cv.height, kc: s.kc.width + 'x' + s.kc.height, boy: s.u.uBoy.value.toArray(), piksel: s.u.uPiksel.value.toArray() }; })));
  // 3) üst üste baslat: tek tuval, tek RAF
  console.log('tekrar', JSON.stringify(await pg.evaluate(async () => { const H = document.getElementById('harita2'); let n = 0; const o = window.requestAnimationFrame; for (let i = 0; i < 5; i++) Deniz2.baslat(H); window.requestAnimationFrame = function (f) { n++; return o(f); }; await new Promise(r => setTimeout(r, 1000)); window.requestAnimationFrame = o; return { cv: document.querySelectorAll('.dz-cv').length, run: RUN.length, rafSaniyede: n }; })));
  // 4) bağlam kaybı -> eski deniz -> kendiliğinden yeniden açılma
  await pg.evaluate(() => Deniz2._durum().renderer.getContext().getExtension('WEBGL_lose_context').loseContext()); await pg.waitForTimeout(400);
  const ara = await pg.evaluate(() => ({ st: !!Deniz2._durum(), dz: document.getElementById('harita2').classList.contains('dz') })); await pg.waitForTimeout(2200);
  console.log('kayip', JSON.stringify(ara), '-> sonra', JSON.stringify(await pg.evaluate(() => ({ st: !!Deniz2._durum(), dz: document.getElementById('harita2').classList.contains('dz'), cv: document.querySelectorAll('.dz-cv').length, run: RUN.length }))));
  // 5) kenar açılması: tuvalin dört kenarında siyah piksel var mı (ağ taşma payı yetiyor mu)
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(900);
  console.log('kenar', JSON.stringify(await pg.evaluate(() => { const s = Deniz2._durum(), g = s.renderer.getContext(); let enAz = 999; for (let k = 0; k < 40; k++) { s.t += 0.37; s.u.uT.value = s.t; s.renderer.render(s.scene, s.cam); const W = s.cv.width, Hh = s.cv.height, px = new Uint8Array(4); for (const [x, y] of [[0, 0], [W - 1, 0], [0, Hh - 1], [W - 1, Hh - 1], [W >> 1, 0], [W >> 1, Hh - 1], [0, Hh >> 1], [W - 1, Hh >> 1]]) { g.readPixels(x, y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); enAz = Math.min(enAz, px[0] + px[1] + px[2]); } } return { enKoyuKenarToplami: enAz }; })));
  console.log('hatalar', m);
  await b.close(); })();
