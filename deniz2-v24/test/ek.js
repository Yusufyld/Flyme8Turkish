const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const durum = () => { const s = Deniz2._durum(), H = document.getElementById('harita2'); return { ok: window.__ok, st: !!s, dz: H.classList.contains('dz'), cv: !!document.querySelector('.dz-cv'), run: RUN.length, webgl2: s && s.renderer.capabilities.isWebGL2, diag: s && s.renderer.info.programs[0] && !!s.renderer.info.programs[0].diagnostics }; };
  for (const [ad, sayfa, init] of [
    ['webgl1', 'gun.html', () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return t === 'webgl2' ? null : g.call(this, t, o); }; }],
    ['bozuk-shader', 'bozuk.html', null],
    ['baglam-kaybi', 'gun.html', null],
  ]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const msgs = [];
    pg.on('console', m => { if (m.type() !== 'warning') msgs.push(m.type() + ': ' + m.text().slice(0, 160).replace(/\n/g, ' ')); }); pg.on('pageerror', e => msgs.push('ERR ' + e));
    if (init) await pg.addInitScript(init);
    await pg.goto((process.env.TABAN || 'http://127.0.0.1:8765/bekleyen/deniz2-v24/test/sayfa/') + sayfa); await pg.waitForTimeout(2500);
    console.log(ad, JSON.stringify(await pg.evaluate(durum)), msgs.slice(0, 3));
    if (ad === 'baglam-kaybi') { await pg.evaluate(() => { const s = Deniz2._durum(); s.renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); }); await pg.waitForTimeout(800); console.log('  kayıptan sonra', JSON.stringify(await pg.evaluate(durum)), msgs.slice(0, 3)); }
    await pg.screenshot({ path: out + '/' + ad + '.png', fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
