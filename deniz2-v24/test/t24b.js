const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [ad, sayfa] of [['v23', 'gun23.html'], ['v24', 'gun.html']]) { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await c.newPage(); await pg.goto((process.env.TABAN || 'http://127.0.0.1:8765/bekleyen/deniz2-v24/test/sayfa/') + sayfa); await pg.waitForTimeout(1500);
    console.log(ad, 'kenar tel dalga=2.5', JSON.stringify(await pg.evaluate(() => { Deniz2.AYAR.dalga = 2.5; const s = Deniz2._durum(), g = s.renderer.getContext(); let siyah = 0, top = 0; const W = g.drawingBufferWidth, Hh = g.drawingBufferHeight, px = new Uint8Array(4);
      for (let k = 0; k < 30; k++) { s.t += 0.41; if (s.ciz) s.ciz(); else { s.u.uT.value = s.t; s.u.uDalga.value = 2.5; s.renderer.render(s.scene, s.cam); }
        for (let i = 0; i < 24; i++) for (const [x, y] of [[Math.floor(W * i / 24), 0], [Math.floor(W * i / 24), Hh - 1], [0, Math.floor(Hh * i / 24)], [W - 1, Math.floor(Hh * i / 24)]]) { g.readPixels(x, y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); top++; if (px[0] + px[1] + px[2] === 0) siyah++; } } Deniz2.AYAR.dalga = 1; return { siyah, top }; })));
    // ilk açılış durumu: dz sınıfı yokken (görsel yüzme animasyonunda) kurulan harita ile duran haldeki harita
    console.log(ad, 'yuzme hizasi', JSON.stringify(await pg.evaluate(async () => { const s = Deniz2._durum(), H = s.H, al = () => s.kc.getContext('2d').getImageData(0, 0, s.kc.width, s.kc.height).data; Deniz2.yenile(); await new Promise(r => setTimeout(r, 300)); const a = al(); let enb = 0;
      for (let k = 0; k < 4; k++) { H.classList.remove('dz'); await new Promise(r => setTimeout(r, 700)); Deniz2.yenile(); await new Promise(r => setTimeout(r, 200)); const c = al(); H.classList.add('dz'); let f = 0; for (let i = 1; i < a.length; i += 4) if (Math.abs(a[i] - c[i]) > 64) f++; enb = Math.max(enb, f); } return { enCokKayanKaraPikseli: enb }; })));
    await c.close(); }
  await b.close(); })();
