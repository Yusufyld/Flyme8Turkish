// Deniz2 v24 düzeltme turu denetimleri: shader derleme (WebGL1/2 x 3 düzey), kalite ayarı, hata denetimi, bağlam kaybı, temizlik, kalite mantığı
const { chromium } = require('playwright');
const TABAN = process.env.TABAN || 'http://127.0.0.1:8765/bekleyen/deniz2-v24/test/sayfa/';
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
let kalan = 0; const yaz = (ad, ok, ek) => { if (!ok) kalan++; console.log((ok ? 'GECTI ' : 'KALDI ') + ad + (ek !== undefined ? '  ' + JSON.stringify(ek) : '')); };
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ac = async (sayfa, o = {}, init) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...o }); const pg = await c.newPage(); pg.hata = [];
    pg.on('pageerror', e => pg.hata.push('ERR ' + e)); pg.on('console', m => { if (m.type() === 'error') pg.hata.push(m.text().slice(0, 160).replace(/\n/g, ' ')); });
    if (init) await pg.addInitScript(init); await pg.goto(TABAN + sayfa); await pg.waitForTimeout(1500); return pg; };
  const webgl1 = () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return t === 'webgl2' ? null : g.call(this, t, o); }; };

  // 1) shader derleme: WebGL2 ve WebGL1, üç düzey
  for (const [ad, init] of [['WebGL2', null], ['WebGL1', webgl1]]) { const pg = await ac('gun.html', {}, init);
    const r = await pg.evaluate(async () => { const s = Deniz2._durum(), g = s.renderer.getContext(), o = { webgl2: s.renderer.capabilities.isWebGL2, surum: g.getParameter(g.VERSION), duzey: {} };
      for (const K of [2, 1, 0]) { s.mat.defines.KALITE = K; s.mat.needsUpdate = true; s.ciz(); const pl = s.renderer.info.programs, p = pl[pl.length - 1]; const px = new Uint8Array(4); g.readPixels(g.drawingBufferWidth >> 1, g.drawingBufferHeight >> 1, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
        o.duzey['K' + K] = { bagli: g.getProgramParameter(p.program, g.LINK_STATUS), tani: p.diagnostics ? p.diagnostics.runnable : 'yok(temiz)', denetim: s.denetim(false), piksel: px[0] + px[1] + px[2] > 0, glHata: g.getError() }; }
      o.program = s.renderer.info.programs.length; return o; });
    const ok = (ad === 'WebGL2') === r.webgl2 && Object.values(r.duzey).every(d => d.bagli && d.denetim === '' && d.piksel && d.glHata === 0) && !pg.hata.length;
    yaz('shader ' + ad + ' (K2,K1,K0)', ok, { surum: r.surum, duzey: r.duzey, konsol: pg.hata }); await pg.context().close(); }

  // 2) smoothstep düzeltmesi görüntüyü değiştirmedi mi: önceki v24 ile piksel karşılaştırması
  { const cek = async (sayfa) => { const pg = await ac(sayfa, { viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' }); const r = await pg.evaluate(() => { const s = Deniz2._durum(), g = s.renderer.getContext(), W = g.drawingBufferWidth, Hh = g.drawingBufferHeight, o = {};
        for (const K of [2, 1, 0]) { s.mat.defines.KALITE = K; s.mat.needsUpdate = true; s.t = 9.7; s.ciz(); const p = new Uint8Array(W * Hh * 4); g.readPixels(0, 0, W, Hh, g.RGBA, g.UNSIGNED_BYTE, p); o[K] = Array.from(p); } return o; }); await pg.context().close(); return r; };
    try { const a = await cek('onceki.html'), c = await cek('gun.html'); const o = {}; let ok = true; for (const K of [2, 1, 0]) { let enb = 0, fark = 0; for (let i = 0; i < a[K].length; i++) { const d = Math.abs(a[K][i] - c[K][i]); if (d) fark++; if (d > enb) enb = d; } o['K' + K] = { farkliDeger: fark, enBuyukFark: enb, piksel: a[K].length / 4 }; if (enb > 1) ok = false; }
      yaz('smoothstep yeniden yazımı: görüntü aynı (en çok 1/255 yuvarlama)', ok, o); } catch (e) { console.log('ATLANDI piksel karşılaştırması (onceki.html yok): ' + String(e).slice(0, 80)); } }

  // 3) çalışırken kalite ayarı
  { const pg = await ac('gun.html'); const r = await pg.evaluate(async () => { const o = [], s = Deniz2._durum(), dur = () => ({ adim: s.adim, sabit: s.sabit, K: s.mat.defines.KALITE, carpan: s.kalite, cv: s.cv.width, AYAR: Deniz2.AYAR.kalite });
      const bekle = (ms) => new Promise(r => setTimeout(r, ms)); o.push(['baslangic', dur()]);
      Deniz2.ayarla({ kalite: 3 }); o.push(['ayarla 3', dur()]); for (let i = 0; i < 6; i++) s.olc(0.05); o.push(['sabitken yavas olcum', dur()]);
      Deniz2.ayarla({ kalite: 5 }); o.push(['ayarla 5', dur()]); Deniz2.ayarla({ kalite: 0 }); o.push(['ayarla 0', dur()]);
      Deniz2.ayarla({ kalite: 99 }); o.push(['ayarla 99', dur()]); Deniz2.ayarla({ kalite: 2.6 }); o.push(['ayarla 2.6', dur()]);
      for (const v of ['abc', NaN, null, undefined, Infinity, {}, '2']) Deniz2.ayarla({ kalite: v }); o.push(['gecersizler', dur()]);
      s.olc(0.05); s.kilit = true; s.tavan = 4; s.yuk = 3; Deniz2.ayarla({ kalite: -1 }); o.push(['ayarla -1', Object.assign(dur(), { kilit: s.kilit, tavan: s.tavan, yuk: s.yuk, onceki: s.onceki })]);
      s.olc(0.05); o.push(['otomatikte yavas olcum', dur()]);
      Deniz2.AYAR.kalite = 1; await bekle(300); o.push(['AYAR.kalite=1 dogrudan', dur()]); await bekle(600); o.push(['denetim', s.denetim(false), !!Deniz2._durum()]); return o; });
    const g = Object.fromEntries(r.map(x => [x[0], x[1]]));
    const ok = g['ayarla 3'].adim === 3 && g['ayarla 3'].sabit && g['ayarla 3'].K === 1 && g['ayarla 3'].carpan === 0.64 && g['ayarla 3'].cv < g.baslangic.cv && g['sabitken yavas olcum'].adim === 3 && g['ayarla 5'].adim === 5 && g['ayarla 5'].K === 0 && g['ayarla 0'].adim === 0 && g['ayarla 0'].K === 2 && g['ayarla 0'].cv === g.baslangic.cv
      && g['ayarla 99'].adim === 5 && g['ayarla 2.6'].adim === 3 && g.gecersizler.adim === 3 && g.gecersizler.AYAR === 3 && g['ayarla -1'].sabit === false && g['ayarla -1'].kilit === false && g['ayarla -1'].tavan === 0 && g['ayarla -1'].yuk === 0 && g['ayarla -1'].onceki === 0
      && g['otomatikte yavas olcum'].adim === 4 && g['AYAR.kalite=1 dogrudan'].adim === 1 && g['AYAR.kalite=1 dogrudan'].sabit && r[r.length - 1][1] === '' && !pg.hata.length;
    yaz('kalite ayari (ayarla + dogrudan AYAR)', ok, r); await pg.context().close(); }
  { const pg = await ac('gun.html', { reducedMotion: 'reduce' }); const r = await pg.evaluate(() => { const s = Deniz2._durum(), f0 = s.renderer.info.render.frame; Deniz2.ayarla({ kalite: 4 }); return { adim: s.adim, K: s.mat.defines.KALITE, yeniCizim: s.renderer.info.render.frame - f0, t: s.t, raf: s.r.raf, st: !!Deniz2._durum(), denetle: !!s.denetle }; });
    yaz('hareketi azalt: kalite ayari aninda cizilir ve denetlenir, animasyon yok', r.adim === 4 && r.K === 0 && r.yeniCizim >= 1 && r.t === 0 && !r.raf && r.st && !r.denetle, r); await pg.context().close(); }

  // 4) hata denetimi
  { const pg = await ac('gun.html'); const r = await pg.evaluate(() => { const s = Deniz2._durum(), o = {}; s.ciz(); o.saglam = s.denetim(true); /* ilk kare denetimi çizimle aynı görevde yapılır (baslat içindeki gibi) */
      const gc = s.renderer.getContext; s.renderer.getContext = () => { throw new Error('x'); }; o.getContextHatasi = s.denetim(false); s.renderer.getContext = gc;
      const info = s.renderer.info, pr = info.programs; Object.defineProperty(info, 'programs', { get() { throw new Error('y'); }, configurable: true }); o.programHatasi = s.denetim(false); Object.defineProperty(info, 'programs', { value: pr, writable: true, configurable: true });
      const g = s.renderer.getContext(), rp = g.readPixels; g.readPixels = () => { throw new Error('z'); }; o.readPixelsHatasi = s.denetim(true); g.readPixels = function () { }; o.bosCizim = s.denetim(true); g.readPixels = rp;
      const gp = g.getProgramParameter; g.getProgramParameter = function (p, n) { return n === g.LINK_STATUS ? false : gp.call(g, p, n); }; o.baglamaHatasi = s.denetim(false);
      // çalışırken shader bozulursa: sonraki karede kaynaklar bırakılır, eski denize dönülür, yeniden denenmez
      s.denetle = true; s.guvenliCiz(); g.getProgramParameter = gp; o.sonra = { st: !!Deniz2._durum(), dz: s.H.classList.contains('dz'), cv: document.querySelectorAll('.dz-cv').length, run: RUN.length, tani: Deniz2._tani() }; return o; });
    yaz('denetim hatalari ayri adlandirilir; beklenmeyen hata basari sayilmaz', r.saglam === '' && r.getContextHatasi === 'baglam' && r.programHatasi === 'denetim' && r.readPixelsHatasi === 'denetim' && r.bosCizim === 'cizim' && r.baglamaHatasi === 'shader' && !r.sonra.st && !r.sonra.dz && r.sonra.cv === 0 && r.sonra.run === 0 && r.sonra.tani.sonHata === 'shader' && !r.sonra.tani.bekliyor, r); await pg.context().close(); }
  { const pg = await ac('bozuk.html'); const r = await pg.evaluate(() => ({ ok: window.__ok, st: !!Deniz2._durum(), dz: document.getElementById('harita2').classList.contains('dz'), cv: document.querySelectorAll('.dz-cv').length, run: RUN.length, tani: Deniz2._tani() }));
    yaz('bozuk shader: eski CSS deniz, neden "shader", yeniden deneme yok', r.ok === false && !r.st && !r.dz && r.cv === 0 && r.run === 0 && r.tani.sonHata === 'shader' && !r.tani.bekliyor, r); await pg.context().close(); }
  { const pg = await ac('gun.html?yokthree'); const r = await pg.evaluate(() => ({ ok: window.__ok, dz: document.getElementById('harita2').classList.contains('dz'), hata: window.__hata }));
    yaz('WebGL/three yok: oyun bozulmaz', r.ok === false && !r.dz && !r.hata.length && !pg.hata.length, r); await pg.context().close(); }

  // 5) bağlam kaybı ve yeniden başlatma sayacı
  { const pg = await ac('gun.html'); const kaybet = () => pg.evaluate(() => { const s = Deniz2._durum(); s.renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); });
    const dur = () => pg.evaluate(() => ({ st: !!Deniz2._durum(), dz: document.getElementById('harita2').classList.contains('dz'), cv: document.querySelectorAll('.dz-cv').length, run: RUN.length, tani: Deniz2._tani() }));
    const o = []; await kaybet(); await bekle(500); o.push(['1. kayip', await dur()]); await bekle(2200); o.push(['1. yeniden', await dur()]);
    await kaybet(); await bekle(500); o.push(['2. kayip', await dur()]); await bekle(2200); o.push(['2. yeniden', await dur()]);
    await kaybet(); await bekle(3200); o.push(['3. kayip (hak bitti)', await dur()]);
    const g = Object.fromEntries(o);
    yaz('ust uste baglam kaybi: iki yeniden baslatma, ucuncude durur (sonsuz dongu yok)', !g['1. kayip'].st && !g['1. kayip'].dz && g['1. kayip'].cv === 0 && g['1. kayip'].tani.bekliyor && g['1. yeniden'].st && g['1. yeniden'].tani.yeniden === 1 && g['2. yeniden'].st && g['2. yeniden'].tani.yeniden === 2 && !g['3. kayip (hak bitti)'].st && !g['3. kayip (hak bitti)'].tani.bekliyor && g['3. kayip (hak bitti)'].run === 0, o);
    // elle baslat hâlâ çalışır; kararlı çalışınca hak tazelenir
    const r2 = await pg.evaluate(async () => { Deniz2.AYAR.kararli = 1; const H = document.getElementById('harita2'), ok = Deniz2.baslat(H), a = Deniz2._tani().yeniden; await new Promise(r => setTimeout(r, 1400)); return { ok, once: a, sonra: Deniz2._tani().yeniden }; });
    await kaybet(); await bekle(2600); const r3 = await dur();
    yaz('kararli calisinca sayac sifirlanir, sonraki kayipta yeniden acilir', r2.ok && r2.once === 2 && r2.sonra === 0 && r3.st && r3.tani.yeniden === 1, { r2, r3 });
    // bekleyen yeniden başlatma varken dur(): iptal
    await bekle(1400); await kaybet(); await bekle(300); const r4 = await pg.evaluate(async () => { const a = Deniz2._tani().bekliyor; Deniz2.dur(); Deniz2.dur(); Deniz2.dur(); const c = Deniz2._tani().bekliyor; await new Promise(r => setTimeout(r, 2200)); return { bekliyordu: a, durSonrasi: c, sonra: !!Deniz2._durum() }; });
    yaz('bekleyen yeniden baslatma dur() ile iptal olur; dur() uc kez hatasiz', r4.bekliyordu && !r4.durSonrasi && !r4.sonra && !pg.hata.filter(h => h.startsWith('ERR')).length, { r4, hata: pg.hata.filter(h => h.startsWith('ERR')) }); await pg.context().close(); }

  // 6) temizlik: dinleyici, zamanlayıcı, gözlemci, RAF dengesi
  { const say = () => { const S = window.__say = { dinle: {}, aralik: 0, zaman: new Set(), raf: 0, ro: 0, io: 0, baglam: [] };
      for (const [hedef, ad] of [[document, 'document'], [HTMLCanvasElement.prototype, 'canvas'], [HTMLImageElement.prototype, 'img']]) { const a = hedef.addEventListener, r = hedef.removeEventListener;
        hedef.addEventListener = function (t, f, o) { const k = ad + ':' + t; S.dinle[k] = (S.dinle[k] || 0) + 1; return a.call(this, t, f, o); }; hedef.removeEventListener = function (t, f, o) { const k = ad + ':' + t; S.dinle[k] = (S.dinle[k] || 0) - 1; return r.call(this, t, f, o); }; }
      const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout; const ar = new Set();
      window.setInterval = function (f, t) { const id = si(f, t); ar.add(id); S.aralik = ar.size; return id; }; window.clearInterval = function (id) { ar.delete(id); S.aralik = ar.size; return ci(id); };
      window.setTimeout = function (f, t) { const id = st(function () { S.zaman.delete(id); f(); }, t); if (t >= 1000) S.zaman.add(id); return id; }; window.clearTimeout = function (id) { S.zaman.delete(id); return ct(id); };
      const RO = window.ResizeObserver, IO = window.IntersectionObserver; window.ResizeObserver = class extends RO { constructor(f) { super(f); S.ro++; } disconnect() { S.ro--; super.disconnect(); } }; window.IntersectionObserver = class extends IO { constructor(f) { super(f); S.io++; } disconnect() { S.io--; super.disconnect(); } };
      const gcx = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { const g = gcx.call(this, t, o); if (g && /webgl/.test(t) && !S.baglam.includes(g)) S.baglam.push(g); return g; }; };
    const pg = await ac('gun.html', {}, say); const r = await pg.evaluate(async () => { const S = window.__say, H = document.getElementById('harita2'), al = () => ({ dinle: Object.fromEntries(Object.entries(S.dinle).filter(([k, v]) => /visibilitychange|webglcontext|img:load/.test(k))), aralik: S.aralik, uzunZaman: S.zaman.size, ro: S.ro, io: S.io });
      const acik = al(); for (let i = 0; i < 5; i++) Deniz2.baslat(H); const bes = al(); let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { n++; return o(f); }; await new Promise(r => setTimeout(r, 1000)); const rafAcik = n;
      Deniz2.dur(); n = 0; await new Promise(r => setTimeout(r, 600)); const kapali = al(), rafKapali = n; window.requestAnimationFrame = o;
      return { acik, besKezBaslat: bes, rafSaniyede: rafAcik, durSonrasi: kapali, durSonrasiRaf: rafKapali, kayipBaglam: S.baglam.filter(g => g.isContextLost()).length + '/' + S.baglam.length, cv: document.querySelectorAll('.dz-cv').length, run: RUN.length, dz: H.classList.contains('dz') }; });
    const sifir = (d) => Object.values(d.dinle).every(v => v === 0) && d.aralik === 0 && d.uzunZaman === 0 && d.ro === 0 && d.io === 0; const ayni = JSON.stringify(r.acik) === JSON.stringify(r.besKezBaslat);
    const tum = r.kayipBaglam.split('/'); yaz('temizlik: dinleyici, aralik, zamanlayici, gozlemci, RAF ve WebGL baglami birakilir; ust uste baslat birikmez', ayni && sifir(r.durSonrasi) && r.durSonrasiRaf === 0 && r.cv === 0 && r.run === 0 && !r.dz && tum[0] === tum[1] && r.rafSaniyede < 80, r); await pg.context().close(); }

  // 7) otomatik kalite mantığı (benzetilmiş kare süreleri; gerçek cihaz ölçümü DEĞİLDİR)
  { const pg = await ac('gun.html'); const r = await pg.evaluate(() => { const H = document.getElementById('harita2'), yeni = () => { Deniz2.baslat(H); return Deniz2._durum(); }, ver = (s, ms, n) => { for (let i = 0; i < n; i++) s.olc(ms / 1000); }, o = {};
      let s = yeni(); const iz = []; for (let i = 0; i < 8; i++) { s.olc(0.0333); iz.push(s.adim + (s.kilit ? 'K' : '')); } o.otuzKare = iz;
      s = yeni(); ver(s, 16.7, 60); o.hizli = { adim: s.adim };
      s = yeni(); const iz2 = []; let v = 40; for (let i = 0; i < 6; i++) { s.olc(v / 1000); v *= 0.7; iz2.push(s.adim); } o.gercekYavas = { iz: iz2, kilit: s.kilit };
      s = yeni(); ver(s, 30, 1); const a1 = s.adim; ver(s, 16.7, 12); const d1 = { adim: s.adim, deneme: s.deneme }; ver(s, 30, 1); const b1 = { adim: s.adim, tavan: s.tavan, deneme: s.deneme }; ver(s, 16.7, 60); o.basarisizDeneme = { dustu: a1, deneme: d1, geriDustu: b1, sonra: { adim: s.adim, yuk: s.yuk } };
      s = yeni(); ver(s, 30, 1); ver(s, 16.7, 12); const d2 = s.adim; ver(s, 16.7, 3); o.basariliDeneme = { denemeAdim: d2, sonra: { adim: s.adim, deneme: s.deneme, tavan: s.tavan } };
      s = yeni(); for (let k = 0; k < 6; k++) { ver(s, 30, 1); ver(s, 16.7, 12); ver(s, 16.7, 3); } o.enCokUcDeneme = { yuk: s.yuk, adim: s.adim }; return o; });
    const ok = r.otuzKare.slice(2).every(x => x === '0K') && r.hizli.adim === 0 && !r.gercekYavas.kilit && r.gercekYavas.iz[0] === 1 && r.basarisizDeneme.dustu === 1 && r.basarisizDeneme.deneme.adim === 0 && r.basarisizDeneme.geriDustu.adim === 1 && r.basarisizDeneme.geriDustu.tavan === 1 && r.basarisizDeneme.sonra.adim === 1
      && r.basariliDeneme.denemeAdim === 0 && r.basariliDeneme.sonra.adim === 0 && !r.basariliDeneme.sonra.deneme && r.enCokUcDeneme.yuk === 3;
    yaz('otomatik kalite (benzetim): 30 karede kilit, hizlida dusmez, basarisiz deneme tavan olur, en cok 3 deneme', ok, r); await pg.context().close(); }

  // 8) ekran dışı ve hareketi azalt
  { const pg = await ac('gun.html'); const r = await pg.evaluate(async () => { const s = Deniz2._durum(), bos = document.createElement('div'); bos.style.height = '5000px'; document.body.insertBefore(bos, document.body.firstChild); window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 600)); let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { n++; return o(f); }; const f0 = s.renderer.info.render.frame, t0 = s.t; await new Promise(r => setTimeout(r, 800)); const d = { gorunur: s.gorunur, rafCagrisi: n, cizim: s.renderer.info.render.frame - f0, tArtti: s.t > t0 }; bos.remove(); await new Promise(r => setTimeout(r, 700)); const t1 = s.t; await new Promise(r => setTimeout(r, 400)); window.requestAnimationFrame = o; return { disarida: d, geri: { gorunur: s.gorunur, raf: !!s.r.raf, tArtti: s.t > t1 } }; });
    yaz('ekran disinda RAF ve cizim yok; geri gelince surer', !r.disarida.gorunur && r.disarida.rafCagrisi === 0 && r.disarida.cizim === 0 && !r.disarida.tArtti && r.geri.raf && r.geri.tArtti, r); await pg.context().close(); }
  { const pg = await ac('gun.html', { reducedMotion: 'reduce' }); const r = await pg.evaluate(async () => { const s = Deniz2._durum(); let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { n++; return o(f); }; await new Promise(r => setTimeout(r, 700)); window.requestAnimationFrame = o; const px = new Uint8Array(4); return { ok: window.__ok, dz: s.H.classList.contains('dz'), t: s.t, raf: s.r.raf, rafCagrisi: n, duragan: s.duragan }; });
    yaz('hareketi azalt: tek kare, dongu yok', r.ok && r.dz && r.t === 0 && !r.raf && r.rafCagrisi === 0 && r.duragan, r); await pg.context().close(); }

  await b.close(); console.log(kalan ? '\nSONUC: ' + kalan + ' denetim KALDI' : '\nSONUC: hepsi gecti'); process.exit(kalan ? 1 : 0); })();
