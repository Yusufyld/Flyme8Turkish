const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const isler = [
    ['tel-gun', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'gun.html'],
    ['tablet-gun', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'gun.html'],
    ['tel-sabah', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, 'sabah.html'],
    ['tel-aksam', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, 'aksam.html'],
    ['tablet-dik', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 }, 'gun.html'],
    ['yedek', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, 'gun.html?yokthree'],
    ['azhareket', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' }, 'gun.html'],
  ];
  for (const [ad, ctxo, sayfa] of isler) {
    const ctx = await b.newContext(ctxo); const pg = await ctx.newPage(); const msgs = [];
    pg.on('console', m => msgs.push(m.type() + ': ' + m.text().slice(0, 400))); pg.on('pageerror', e => msgs.push('ERR ' + e));
    await pg.goto((process.env.TABAN || 'http://127.0.0.1:8765/bekleyen/deniz2-v24/test/sayfa/') + sayfa); await pg.waitForTimeout(3000);
    const bilgi = await pg.evaluate(() => { const s = Deniz2._durum(), c = document.querySelector('.dz-cv'); let gl = null, px = null, rev = window.THREE ? THREE.REVISION : null;
      if (s) { const g = s.renderer.getContext(); gl = { v: g.getParameter(g.VERSION), webgl2: s.renderer.capabilities.isWebGL2, prec: s.renderer.capabilities.precision, cagri: s.renderer.info.render.calls, prog: s.renderer.info.programs.length, diag: s.renderer.info.programs[0] && s.renderer.info.programs[0].diagnostics, err: g.getError() }; }
      return { ok: window.__ok, rev, dz: document.getElementById('harita2').classList.contains('dz'), kalite: s && s.kalite, t: s && s.t, cv: c && c.width + 'x' + c.height, kc: s && s.kc.width + 'x' + s.kc.height, gl, hata: window.__hata }; });
    console.log(ad, JSON.stringify(bilgi), msgs.slice(0, 6));
    await pg.screenshot({ path: out + '/' + ad + '-1.png', fullPage: true });
    if (bilgi.dz) { await pg.waitForTimeout(1800); await pg.screenshot({ path: out + '/' + ad + '-2.png', fullPage: true });
      const t2 = await pg.evaluate(() => Deniz2._durum() && Deniz2._durum().t); console.log('   t sonra:', t2);
      if (ad === 'tel-gun') { // kapatma ve yeniden açma
        const k = await pg.evaluate(() => { stop = Deniz2._durum().r; stop.off(); const H = document.getElementById('harita2'); const a = { dz: H.classList.contains('dz'), cv: !!document.querySelector('.dz-cv'), run: RUN.length }; const y = Deniz2.baslat(H); return { kapali: a, yeniden: y, run: RUN.length, cvSay: document.querySelectorAll('.dz-cv').length }; });
        console.log('   kapat/aç:', JSON.stringify(k)); }
    }
    await ctx.close();
  }
  await b.close();
})();
