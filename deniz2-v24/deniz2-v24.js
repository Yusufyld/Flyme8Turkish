/* ===================== DENİZ 2 (v24): ana haritada canlı WebGL deniz + kıyı köpüğü =====================
   - three.js r128 ShaderMaterial, tek ağ, tek çizim çağrısı.
   - Köşe shader'ı ağı gerçekten kaydırır (dört Gerstner dalgası); ağ ekrandan taşar ki kenar açılmasın (pay, dalga gücüne göre kendiliğinden büyür).
     Yüzey deseni kayan köşelerle taşınır; kıyı haritası ise ekrana sabit okunur (gl_FragCoord), adalarla hizası bozulmaz.
   - Geometri ile ışık ayrı ama tutarlı: köşe shader'ı dalganın gerçek eğimini verir (vD.xy), parça shader'ı buna küçük dalgacıkların
     türevini ekleyip tek bir yüzey normali kurar. EGIM yalnız görsel abartıdır (üstten bakışta gerçek eğim çok küçük kalır).
   - Kıyı, ada görsellerinin şeffaflığından çıkarılır (kiyiHaritasi): R = kıyıya yakın uzaklık (köpük), G = kara, B = geniş uzaklık (derinlik).
     Ada görseli, yeri ya da ekran boyutu değişince harita yeniden kurulur; köpük kendiliğinden uyar.
   - Yansıma gerçek değil: gök rengi Fresnel ile karıştırılır, güneş parıltısı shader'da hesaplanır. Ortam haritası / ikinci çizim yok.
   - WebGL yoksa, shader derlenmezse ya da hata olursa tuval kaldırılır, eski CSS deniz görünür.
   AYAR.kiyi: 'taban' = süzülen kaya tabanlı görseller (alt yarı + taban elipsi), 'tam' = kumsallı görseller (tüm siluet).
   Tek adaya özel: <button class="h2-ada" data-kiyi="tam"> */
var Deniz2 = (function () {
  var AYAR = { kiyi: 'taban', kopukPx: 84, kopukOran: 0.42, desenPx: 96, desenOran: 0.2, olcek: 1.5, enCokPiksel: 1000000, izgara: 512,
    /* canlı ayarlar: çalışırken değiştirilebilir. Çözünürlük, derinlik ve kıyı ayarları için Deniz2.ayarla({...}) kullan (haritayı yeniler) */
    hiz: 1.0,        /* animasyon hızı çarpanı */
    dalga: 1.0,      /* büyük dalga gücü (0 = ağ kıpırdamaz) */
    kopuk: 1.0,      /* köpük genişliği çarpanı */
    kopukYogun: 1.0, /* v24: köpük yoğunluğu (0 = köpük yok, 1 = dengeli, 1.5 = bol) */
    kostik: 1.0,     /* su altı ışık ağı gücü */
    parlama: 1.0,    /* güneş parıltısı gücü */
    yansima: 1.0,    /* v24: gök yansıması hissi (Fresnel) gücü */
    derinlik: 3.0,   /* derin mavi, köpük mesafesinin kaç katında başlar */
    tasma: 0.05,     /* ağın ekrandan en az taşma payı */
    ag: [40, 56],    /* ağ bütçesi: toplam bölme sayısı ag[0]*ag[1]; v24 bunu ekran oranına göre yatay/dikey paylaştırır */
    kalite: -1,      /* v24: -1 = kendiliğinden; 0..5 = kaliteAdim içindeki sabit kademe */
    kaliteAdim: [[1, 2], [0.8, 2], [0.8, 1], [0.64, 1], [0.64, 0], [0.52, 0]] /* [çözünürlük çarpanı, shader düzeyi] */ };
  var PAL = {
    gun:   { derin: [0.06, 0.47, 0.82], orta: [0.10, 0.67, 0.90], sig: [0.45, 0.92, 0.90], kum: [0.86, 0.95, 0.80], gok: [0.80, 0.93, 1.00], gunes: [1.00, 0.98, 0.90] },
    sabah: { derin: [0.10, 0.48, 0.80], orta: [0.24, 0.72, 0.88], sig: [0.60, 0.94, 0.88], kum: [0.93, 0.94, 0.78], gok: [1.00, 0.93, 0.82], gunes: [1.00, 0.93, 0.78] },
    aksam: { derin: [0.13, 0.40, 0.76], orta: [0.29, 0.64, 0.86], sig: [0.64, 0.90, 0.86], kum: [0.95, 0.90, 0.78], gok: [1.00, 0.84, 0.78], gunes: [1.00, 0.85, 0.70] }
  };
  var GENLIK = 0.134; /* dört dalganın genlik toplamı (desen birimi); köşe shader'ındaki değerlerle aynı olmalı */
  var st = null, yeniden = 0, bek = null;

  var VS = [
    'uniform float uT; uniform vec2 uBoy; uniform float uDesen; uniform float uDalga; uniform vec2 uTasma;',
    'varying vec2 vP; varying vec3 vD;',
    /* tek Gerstner dalgası: yön, dalga boyu (desen birimi), genlik, hız, faz. Birikim: s.xy yatay kayma, s.z yükseklik, e.xy eğim, e.z diklik */
    'void dalga(vec2 p, vec2 yon, float boy, float gen, float hiz, float fz, inout vec3 s, inout vec3 e){',
    '  float k = 6.2831853 / boy, a = k * dot(yon, p) - hiz * uT + fz, c = cos(a), sn = sin(a);',
    '  s += vec3(yon * gen * c, gen * sn); e += vec3(yon * k * gen * c, k * gen * sn); }',
    'void main(){',
    '  vec2 q = position.xy * (1.0 + 2.0 * uTasma);',
    '  vec2 p = (q * 0.5 + 0.5) * uBoy / uDesen;',
    '  vec3 s = vec3(0.0); vec3 e = vec3(0.0);',
    /* baskın yön sağ-üst; ikisi ±40 derece yelpazede, en kısası çapraz çırpıntı. Karşılıklı giden çift yok (duran dalga görünümü olmaz).
       Hızlar derin su bağıntısına uyar: hız = 0.382 * karekök(2pi / boy); uzun dalga yavaş, kısa dalga hızlı. */
    '  dalga(p, vec2( 0.883,  0.469), 5.20, 0.060, 0.420, 0.0, s, e);',
    '  dalga(p, vec2( 0.951, -0.309), 3.40, 0.038, 0.519, 1.7, s, e);',
    '  dalga(p, vec2( 0.485,  0.875), 2.20, 0.024, 0.646, 4.1, s, e);',
    '  dalga(p, vec2(-0.695,  0.719), 1.35, 0.012, 0.824, 2.6, s, e);',
    /* Gerstner yüzeyinin gerçek eğimi: e.xy / (1 - diklik). Tepeler sivri, çukurlar yayvan; geometriyle aynı biçim */
    '  vP = p; vD = vec3(e.xy * uDalga / max(0.4, 1.0 - e.z * uDalga), s.z / 0.134 * uDalga);',
    '  gl_Position = vec4(q + s.xy * uDalga * uDesen / uBoy * 2.0, 0.0, 1.0);',
    '}'].join('\n');

  var FS = [
    'uniform sampler2D uKiyi; uniform vec2 uBoy; uniform vec2 uPiksel; uniform float uT; uniform float uDesen;',
    'uniform vec3 uDerin; uniform vec3 uOrta; uniform vec3 uSig; uniform vec3 uKum; uniform vec3 uGok; uniform vec3 uGunes; uniform vec2 uGunesYer;',
    'uniform float uKopuk; uniform float uYogun; uniform float uKostik; uniform float uParlama; uniform float uYansima;',
    'varying vec2 vP; varying vec3 vD;',
    '#define EGIM 2.2',
    '#if KALITE >= 1',
    '#define TUR 4',
    '#else',
    '#define TUR 3',
    '#endif',
    'float h1(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }',
    /* türevli gürültü: x = değer, yz = eğim. Tek okumada üçü birden; v23'teki üç ayrı örnekleme (sonlu fark) gerekmez */
    'vec3 nd(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);',
    '  float a = h1(i), b = h1(i + vec2(1.0, 0.0)), c = h1(i + vec2(0.0, 1.0)), d = h1(i + vec2(1.0, 1.0)), k1 = b - a, k2 = c - a, k4 = a - b - c + d;',
    '  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x)); }',
    /* küçük dalgacıklar: üç kat, her biri ayrı yöne akar; katlar birbirine göre döndürülür ki kareli doku seçilmesin */
    'const mat2 D1 = mat2(0.8, 0.6, -0.6, 0.8); const mat2 D2 = mat2(0.28, -0.96, 0.96, 0.28);',
    'vec3 yuzey(vec2 p){ float t = uT;',
    '  vec3 a = nd(p * 1.1 + vec2(t * 0.20, t * 0.12)), b = nd(D1 * p * 2.7 - vec2(t * 0.25, -t * 0.18));',
    '  vec3 r = vec3(a.x * 0.60 + b.x * 0.30, a.yz * 0.66 + (b.yz * D1) * 0.81);',
    '#if KALITE >= 1',
    '  vec3 c = nd(D2 * p * 6.0 + vec2(-t * 0.40, t * 0.30)); r += vec3(c.x * 0.10, (c.yz * D2) * 0.34);',
    '#else',
    '  r.x += 0.05;',
    '#endif',
    '  return r; }',
    /* su altı ışık ağı. v23 ile aynı desen; bölmeler tek bölmeye indirildi, payda sıfır olamaz (küçük sabit eklenir) */
    'float agisik(vec2 q, float tm){ vec2 p = mod(q, 6.2831853) - 250.0; vec2 i = p; float c = 1.0;',
    '  for (int k = 0; k < TUR; k++) { float tt = tm * (1.0 - 3.5 / float(k + 1));',
    '    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));',
    '    float sx = sin(i.x + tt), cy = cos(i.y + tt);',
    '    c += abs(sx * cy) / (0.005 * length(vec2(p.x * cy, p.y * sx)) + 0.00001); }',
    '  c /= float(TUR); c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }',
    'void main(){',
    '  float t = uT; vec2 p = vP; vec2 ek = gl_FragCoord.xy / uPiksel;',
    /* kıyı haritası ekrana sabit okunur; ağ kaysa da adalarla hizası bozulmaz */
    '  vec4 k = texture2D(uKiyi, ek); float d = k.r, kara = k.g, uzak = k.b, dk = d / uKopuk;',
    /* yüzey normali: küçük dalgacıkların türevi (parça) + büyük dalganın gerçek eğimi (köşe); ikisi aynı yönde toplanır */
    '  vec3 yz = yuzey(p); float a = yz.x; vec2 egim = yz.yz * 0.5 + vD.xy * EGIM;',
    '  vec3 N = normalize(vec3(-egim * 0.55, 1.0));',
    /* bakış: haritanın üstü biraz daha yatık görülür; gök yansıması yukarı doğru hafifçe artar */
    '  vec3 V = normalize(vec3(0.0, -0.38 - 0.24 * ek.y, 0.86));',
    /* Fresnel daha yumuşak bir normalle hesaplanır (dalgacık payı az): gök yansıması benek benek değil, dalga sırtlarında geniş geçişle belirir */
    '  vec3 Ny = normalize(vec3(-(yz.yz * 0.16 + vD.xy * EGIM) * 0.55, 1.0));',
    '  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(Ny, V), 0.0), 3.0);',
    /* derinlik: kıyıda kumlu açık turkuaz -> doygun turkuaz -> orta mavi -> açıkta koyu mavi. Geçiş çizgisi dalgacıkla hafifçe oynar */
    '  float buyuk = n(p * 0.22 + vec2(t * 0.01, 0.0));',
    '  float der = smoothstep(0.30, 1.0, uzak), dd = clamp(d + (a - 0.5) * 0.10 - vD.z * 0.02, 0.0, 1.0);',
    '  vec3 turkuaz = mix(uSig, uOrta, 0.58) * vec3(0.80, 1.04, 1.03);',
    '  vec3 col = mix(uSig, turkuaz, smoothstep(0.0, 0.32, dd));',
    '  col = mix(col, uOrta, smoothstep(0.24, 0.66, dd));',
    '  col = mix(col, uDerin, smoothstep(0.30, 1.0, dd) * (0.25 + 0.75 * der) * (0.72 + 0.28 * buyuk));',
    '  col = mix(col, uDerin * vec3(0.78, 0.86, 0.95), der * der * 0.55 * (0.5 + 0.5 * buyuk));',
    '  float kumluk = smoothstep(0.36, 0.0, dd); col = mix(col, uKum, kumluk * kumluk * (0.50 + 0.16 * a));',
    /* dalgaya bağlı ışık: tepe aydınlık ve hafif turkuaz, çukur biraz koyu */
    '  col *= 0.93 + 0.10 * a + vD.z * 0.09; col += (uSig - col) * max(vD.z, 0.0) * 0.07;',
    /* su altı ışık ağı: yüzey eğimiyle kırılır. Sığda ince ve belirgin, derinde iri ve silik. Geniş gürültü deseni büker; aynı şekil yan yana yinelenmez */
    '  vec2 pk = p - egim * 0.07 + (buyuk - 0.5) * vec2(0.5, -0.35); float sigl = 1.0 - smoothstep(0.0, 0.95, d * 0.45 + uzak * 0.55);',
    '  float c1 = min(agisik(pk * 3.1, t * 0.42), 1.0), c = c1 * 0.8;',
    '#if KALITE >= 2',
    '  float c2 = min(agisik(pk * 1.7 + vec2(3.7, 1.9), 2.0 - t * 0.29), 1.0); c = min(mix(c1 * 0.30 + c2 * 0.58, c1 * 0.62 + c2 * 0.26, sigl), 1.0);',
    '#endif',
    '  col += vec3(0.55, 0.95, 0.92) * c * uKostik * mix(0.13, 0.42, sigl * sqrt(sigl)) * (0.70 + 0.60 * buyuk);',
    /* yansıma hissi: gök rengi Fresnel ile (gerçek yansıma değil) */
    '  col = mix(col, uGok, min(fr * 0.75 * uYansima, 0.6));',
    /* güneş: eğime bağlı dar parıltı + geniş yumuşak ışıma; güneş altında dalgayla açılıp kapanan pullar */
    '  vec3 Hh = normalize(normalize(vec3(0.35, 0.45, 0.82)) + V); float nh = max(dot(N, Hh), 0.0);',
    '  float sp = pow(nh, 320.0) * 0.42 * (0.35 + 0.65 * smoothstep(-0.3, 0.6, vD.z)) + pow(nh, 36.0) * 0.07;',
    '#if KALITE >= 1',
    '  vec2 gy = (ek - uGunesYer) * vec2(2.5, 3.2) * vec2(1.0, uBoy.y / uBoy.x); float gz = exp(-dot(gy, gy));',
    '  sp += pow(n(p * 13.0 + vec2(t * 0.50, -t * 0.35)) * n(p * 17.0 - vec2(t * 0.40, t * 0.30)), 6.0) * 7.0 * gz * (0.30 + 1.1 * smoothstep(0.93, 0.995, nh));',
    '  sp += gz * (0.045 + 0.035 * vD.z);',
    '#endif',
    '  col += uGunes * sp * uParlama;',
    /* kara altı: sığ kumluk */
    '  col = mix(col, mix(uSig, uKum, 0.55) + c * 0.25, kara);',
    /* köpük. Su yüksekken (dalga tepesi) kıyı çizgisi biraz açılır: gk. Kara maskesi oynamaz, adalar yerinde kalır.
       1) kıyıda kırılan şerit: dalga çizgisi kıyıya varınca genişler, sonra çekilir; yer yer hiç yoktur
       2) kıyıya yürüyen çizgiler: kıyıya yaklaştıkça sıklaşır, gürültüyle bükülür ve kopar
       3) kırık parçalar 4) ince dantel 5) köpüğün suya karıştığı süt mavisi hale */
    '  float kb = n(p * 0.35);',
    '  float yog = smoothstep(0.22, 0.78, n(p * 0.8 + vec2(0.0, t * 0.03)) + (uYogun - 1.0) * 0.4);',
    '  float gk = max(dk - vD.z * 0.035, 0.0);',
    '  float faz = t * 0.20 + kb * 0.9 + vD.z * 0.12, vur = fract(faz);',
    '  float cek = smoothstep(0.82, 1.0, vur) + 1.0 - smoothstep(0.0, 0.62, vur);',
    '  float n3 = n(p * 3.0 + vec2(t * 0.15, 0.0)), n5 = n(p * 5.0 + vec2(t * 0.30, -t * 0.2));',
    '#if KALITE >= 1',
    '  n5 = n5 * 0.75 + n(p * 13.0 - vec2(t * 0.2, t * 0.25)) * 0.25;',
    '#endif',
    '  float w1 = 0.12 + 0.13 * cek;',
    '  float serit = smoothstep(w1, w1 * 0.30, gk) * smoothstep(0.36, 0.72, n5 + (1.0 - gk / w1) * (0.08 + 0.50 * yog + 0.12 * cek)) * smoothstep(0.16, 0.40, kb + 0.25 * yog);',
    '  float gw = gk + (n3 - 0.5) * 0.10;',
    '  float bant = fract(pow(max(gw, 0.0), 0.72) * 2.6 + faz);',
    '  float cizgi = smoothstep(0.0, 0.07, bant) * smoothstep(0.20 + 0.20 * n5, 0.07, bant);',
    '  cizgi *= smoothstep(0.66, 0.10, gk) * smoothstep(0.30, 0.54, n3 + (1.0 - gk) * 0.34) * (0.25 + 0.75 * yog);',
    '  float parca = smoothstep(0.34, 0.50, n(p * 7.0 - vec2(t * 0.20, t * 0.1)) * n(p * 3.3 + t * 0.10)) * smoothstep(0.50, 0.0, gk) * (0.35 + 0.65 * yog);',
    '  float dantel = smoothstep(0.30, 0.95, c1) * smoothstep(0.50, 0.04, gk) * (0.22 + 0.44 * yog);',
    '  float deniz = 1.0 - kara * 0.85, yg = clamp(uYogun, 0.0, 1.0);',
    '  col = mix(col, uSig * 0.6 + 0.42, smoothstep(0.60, 0.0, gk) * (0.10 + 0.14 * yog) * deniz * yg);',
    '  float kopuk = clamp(serit + cizgi * 1.25 + parca * 0.55 + dantel, 0.0, 1.0) * deniz * yg;',
    '  col = mix(col, mix(vec3(0.97, 0.995, 1.0), uGunes, 0.2), kopuk);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'].join('\n');

  /* Ada görsellerinden kıyı haritası: R yakın uzaklık (0 kıyı, 255 köpük sınırı), G kara, B geniş uzaklık (derinlik) */
  function kiyiHaritasi(H, cv) {
    var W = H.clientWidth, Hh = H.clientHeight; if (!W || !Hh) return false;
    var gs = AYAR.izgara / Math.max(W, Hh), gw = Math.max(8, Math.round(W * gs)), gh = Math.max(8, Math.round(Hh * gs)), N = gw * gh;
    var mask = new Float32Array(N), hr = H.getBoundingClientRect();
    /* v24: harita ölçekliyse (transform) ya da kenarlığı varsa da hiza tutsun: ekran pikselini haritanın kendi pikseline çevir */
    var ox = H.offsetWidth ? hr.width / H.offsetWidth : 1, oy = H.offsetHeight ? hr.height / H.offsetHeight : 1; if (!(ox > 0)) ox = 1; if (!(oy > 0)) oy = 1;
    var sol = hr.left + H.clientLeft * ox, ust = hr.top + H.clientTop * oy;
    var tc = null, tx = null, tuval = function () { tc = document.createElement('canvas'); tc.width = gw; tc.height = gh; tx = tc.getContext('2d', { willReadFrequently: true }); };
    tuval();
    var adalar = H.querySelectorAll('.h2-ada'), gen = 0, say = 0;
    for (var ai = 0; ai < adalar.length; ai++) {
      var b = adalar[ai], im = b.querySelector('img'); if (!im || !im.complete || !im.naturalWidth) continue;
      /* v24: görselin kendi animasyonu / büyütmesi (yüzme, seçili) ölçüye karışmasın: yerleşim kutusu kullanılır */
      var r = im.getBoundingClientRect(), rl = r.left, rt = r.top, rw = r.width, rh = r.height;
      if (im.offsetParent === b && im.offsetWidth) { var br = b.getBoundingClientRect(), bx = b.offsetWidth ? br.width / b.offsetWidth : ox, by = b.offsetHeight ? br.height / b.offsetHeight : oy;
        rl = br.left + (b.clientLeft + im.offsetLeft) * bx; rt = br.top + (b.clientTop + im.offsetTop) * by; rw = im.offsetWidth * bx; rh = im.offsetHeight * by; }
      var x = (rl - sol) / ox * gs, y = (rt - ust) / oy * gs, w = rw / ox * gs, h = rh / oy * gs; if (w < 2 || h < 2) continue; gen += rw / ox; say++;
      var x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(gw, Math.ceil(x + w)), y1 = Math.min(gh, Math.ceil(y + h)); if (x1 <= x0 || y1 <= y0) continue;
      var tam = (b.dataset.kiyi || AYAR.kiyi) === 'tam', px = null;
      /* başka kaynaktan gelen görsel tuvali kirletir (SecurityError): o ada elipse düşer, tuval yenilenir ki sonraki adalar okunabilsin */
      try { tx.clearRect(0, 0, gw, gh); tx.drawImage(im, x, y, w, h); px = tx.getImageData(x0, y0, x1 - x0, y1 - y0).data; } catch (e) { px = null; try { tuval(); } catch (e2) {} }
      var rx = w * 0.47, ry = rx * 0.42, cx = x + w / 2, cy = y + h - ry * 1.08;
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) {
        var al = px ? px[((yy - y0) * (x1 - x0) + (xx - x0)) * 4 + 3] / 255 : 0, m;
        if (tam && px) m = al;
        else { var qx = (xx + 0.5 - cx) / rx, qy = (yy + 0.5 - cy) / ry, q = Math.sqrt(qx * qx + qy * qy), el = Math.max(0, Math.min(1, (1 - q) * rx * 0.5 + 0.5)); m = Math.max(yy + 0.5 >= cy ? al : 0, el); }
        var i = yy * gw + xx; if (m > mask[i]) mask[i] = m;
      }
    }
    /* v24: tam Öklid uzaklık dönüşümü (Felzenszwalb, iki tek boyutlu geçiş). v23'teki 1 / 1.41 adımlı yaklaşık yöntem eş uzaklık
       çizgilerini sekizgene çeviriyordu (yüzde 8'e varan hata); köpük halkaları köşeli çıkıyordu. Başlangıç değeri kenar pikselinin
       doluluğundan gelir; kıyı çizgisi basamaklı çıkmaz */
    var D = new Float32Array(N), INF = 1e20, i2, X, Y, mxn = Math.max(gw, gh);
    var f = new Float64Array(mxn), o1 = new Float64Array(mxn), vv = new Int32Array(mxn), zz = new Float64Array(mxn + 1);
    function gec(n) { var k = 0, q, p, s;
      vv[0] = 0; zz[0] = -Infinity; zz[1] = Infinity;
      for (q = 1; q < n; q++) { for (;;) { p = vv[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * (q - p)); if (s <= zz[k] && k > 0) k--; else break; }
        if (s <= zz[k]) { vv[k] = q; zz[k] = -Infinity; zz[k + 1] = Infinity; } else { k++; vv[k] = q; zz[k] = s; zz[k + 1] = Infinity; } }
      for (k = 0, q = 0; q < n; q++) { while (zz[k + 1] < q) k++; p = vv[k]; o1[q] = (q - p) * (q - p) + f[p]; } }
    for (i2 = 0; i2 < N; i2++) { var b0 = mask[i2] >= 0.5 ? 0 : (mask[i2] > 0.02 ? 1 - mask[i2] * 2 : INF); D[i2] = b0 >= INF ? INF : b0 * b0; }
    for (X = 0; X < gw; X++) { for (Y = 0; Y < gh; Y++) f[Y] = D[Y * gw + X]; gec(gh); for (Y = 0; Y < gh; Y++) D[Y * gw + X] = o1[Y]; }
    for (Y = 0; Y < gh; Y++) { for (X = 0; X < gw; X++) f[X] = D[Y * gw + X]; gec(gw); for (X = 0; X < gw; X++) D[Y * gw + X] = Math.sqrt(o1[X]); }
    var mx = Math.max(26, Math.min(AYAR.kopukPx, (say ? gen / say : 100) * AYAR.kopukOran)) * gs, mx2 = mx * Math.max(1.2, AYAR.derinlik), S = new Float32Array(N), S2 = new Float32Array(N);
    for (Y = 0; Y < gh; Y++) for (X = 0; X < gw; X++) { var s = 0, s2 = 0, nn = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var u = X + dx, w2 = Y + dy; if (u < 0 || w2 < 0 || u >= gw || w2 >= gh) continue; var dd = D[w2 * gw + u]; s += Math.min(dd, mx); s2 += Math.min(dd, mx2); nn++; }
      S[Y * gw + X] = s / nn; S2[Y * gw + X] = s2 / nn; }
    cv.width = gw; cv.height = gh; var cx2 = cv.getContext('2d'), id = cx2.createImageData(gw, gh), o = id.data;
    for (i2 = 0; i2 < N; i2++) { o[i2 * 4] = Math.round(Math.min(1, S[i2] / mx) * 255); o[i2 * 4 + 1] = Math.round(mask[i2] * 255); o[i2 * 4 + 2] = Math.round(Math.min(1, S2[i2] / mx2) * 255); o[i2 * 4 + 3] = 255; }
    cx2.putImageData(id, 0, 0); return true;
  }

  /* bağlam kaybından sonra bekleyen yeniden başlatmayı iptal et */
  function bekIptal() { var b = bek; if (!b) return; bek = null; clearTimeout(b.zam); if (b.gor) document.removeEventListener('visibilitychange', b.gor); }

  function dur() {
    bekIptal();
    var s = st; if (!s) return; st = null; s.canli = false;
    cancelAnimationFrame(s.r.raf); s.r.raf = 0; clearTimeout(s.zam); clearInterval(s.bekci);
    try { if (s.ro) s.ro.disconnect(); } catch (e) {} try { if (s.io) s.io.disconnect(); } catch (e) {}
    s.cv.removeEventListener('webglcontextlost', s.kayip);
    if (s.uyan) document.removeEventListener('visibilitychange', s.uyan);
    for (var i = 0; i < s.dinle.length; i++) s.dinle[i][0].removeEventListener('load', s.dinle[i][1]);
    s.dinle = [];
    try { s.doku.dispose(); s.mat.dispose(); s.geo.dispose(); } catch (e) {}
    try { s.renderer.dispose(); if (s.renderer.forceContextLoss) s.renderer.forceContextLoss(); } catch (e) {}
    if (typeof RUN !== 'undefined') { var k = RUN.indexOf(s.r); if (k >= 0) RUN.splice(k, 1); }
    if (s.cv.parentNode) s.cv.parentNode.removeChild(s.cv); s.H.classList.remove('dz');
  }

  function baslat(H) {
    dur(); if (!H || !window.THREE) return false;
    var T = THREE, cv = document.createElement('canvas'), renderer; cv.className = 'dz-cv'; cv.setAttribute('aria-hidden', 'true');
    try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { return false; }
    /* kurulum yarıda kalırsa WebGL bağlamı açıkta kalmasın (tarayıcıların bağlam sayısı sınırlı) */
    var birak = function () { try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {} };
    var s = { H: H, cv: cv, renderer: renderer, canli: true, t: 0, son: 0, kalite: 1, adim: 0, gorunur: true, sayac: 0, top: 0, isin: 0, dinle: [], zam: 0, bekci: 0,
      iyi: 0, tavan: 0, onceki: 0, etkisiz: 0, deneme: false, kilit: false, yuk: 0, agN: '', r: { raf: 0, renderer: renderer, off: null } };
    try {
      try { renderer.debug.checkShaderErrors = true; } catch (e0) {}
      var faz = typeof fazNow === 'function' ? fazNow() : 'gun', P = PAL[faz] || PAL.gun, V3 = function (a) { return new T.Vector3(a[0], a[1], a[2]); };
      s.kc = document.createElement('canvas'); s.kc.width = s.kc.height = 8; var k2 = s.kc.getContext('2d'); k2.fillStyle = '#ff00ff'; k2.fillRect(0, 0, 8, 8);
      s.doku = new T.CanvasTexture(s.kc); s.doku.minFilter = s.doku.magFilter = T.LinearFilter; s.doku.generateMipmaps = false; s.doku.wrapS = s.doku.wrapT = T.ClampToEdgeWrapping;
      s.u = { uKiyi: { value: s.doku }, uBoy: { value: new T.Vector2(1, 1) }, uPiksel: { value: new T.Vector2(1, 1) }, uT: { value: 0 }, uDesen: { value: AYAR.desenPx },
        uDalga: { value: 1 }, uTasma: { value: new T.Vector2(0.05, 0.05) }, uKopuk: { value: 1 }, uYogun: { value: 1 }, uKostik: { value: 1 }, uParlama: { value: 1 }, uYansima: { value: 1 },
        uDerin: { value: V3(P.derin) }, uOrta: { value: V3(P.orta) }, uSig: { value: V3(P.sig) }, uKum: { value: V3(P.kum || P.sig) }, uGok: { value: V3(P.gok) }, uGunes: { value: V3(P.gunes) }, uGunesYer: { value: new T.Vector2(0.68, 0.30) } };
      var L0 = AYAR.kaliteAdim, a0 = AYAR.kalite >= 0 ? Math.min(L0.length - 1, AYAR.kalite | 0) : 0; s.adim = a0; s.kalite = L0[a0][0]; s.sabit = AYAR.kalite >= 0;
      s.mat = new T.ShaderMaterial({ uniforms: s.u, vertexShader: VS, fragmentShader: FS, defines: { KALITE: L0[a0][1] }, depthTest: false, depthWrite: false });
      s.geo = new T.PlaneGeometry(2, 2, AYAR.ag[0], AYAR.ag[1]); s.scene = new T.Scene(); s.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      s.mesh = new T.Mesh(s.geo, s.mat); s.mesh.frustumCulled = false; s.scene.add(s.mesh);
    } catch (e) { birak(); return false; }
    H.insertBefore(cv, H.firstChild); st = s;

    /* ağ bütçesi aynı kalır; bölmeler ekran oranına göre paylaştırılır ki hücreler kareye yakın olsun (yatay tablette yatay bölme artar) */
    var agKur = function (W, Hh) { var top = Math.max(64, AYAR.ag[0] * AYAR.ag[1]), nx = Math.max(8, Math.min(160, Math.round(Math.sqrt(top * W / Hh)))), ny = Math.max(8, Math.min(160, Math.round(top / nx))), ad = nx + 'x' + ny;
      if (ad === s.agN) return; var eski = s.geo; s.geo = new T.PlaneGeometry(2, 2, nx, ny); s.mesh.geometry = s.geo; s.agN = ad; try { eski.dispose(); } catch (e) {} };
    var boyut = function () { var W = H.clientWidth, Hh = H.clientHeight; if (!W || !Hh) return;
      var pr = Math.min(window.devicePixelRatio || 1, AYAR.olcek) * s.kalite; if (W * Hh * pr * pr > AYAR.enCokPiksel) pr = Math.sqrt(AYAR.enCokPiksel / (W * Hh));
      var pw = Math.max(2, Math.round(W * pr)), ph = Math.max(2, Math.round(Hh * pr));
      if (cv.width !== pw || cv.height !== ph) { renderer.setPixelRatio(1); renderer.setSize(pw, ph, false); }
      var g = renderer.getContext(); s.u.uPiksel.value.set(g.drawingBufferWidth || cv.width, g.drawingBufferHeight || cv.height);
      s.u.uBoy.value.set(W, Hh); s.u.uDesen.value = Math.max(64, Math.min(AYAR.desenPx, W * AYAR.desenOran)); agKur(W, Hh); };
    var ciz = function () { var u = s.u, dl = AYAR.dalga, pay = GENLIK * Math.abs(dl) * u.uDesen.value + 2;
      u.uT.value = s.t; u.uDalga.value = dl; u.uTasma.value.set(Math.max(AYAR.tasma, pay / u.uBoy.value.x), Math.max(AYAR.tasma, pay / u.uBoy.value.y));
      u.uKopuk.value = Math.max(0.2, AYAR.kopuk); u.uYogun.value = AYAR.kopukYogun; u.uKostik.value = AYAR.kostik; u.uParlama.value = AYAR.parlama; u.uYansima.value = AYAR.yansima;
      renderer.render(s.scene, s.cam); };
    var kiyi = function () { if (st !== s) return; try { if (kiyiHaritasi(H, s.kc)) s.doku.needsUpdate = true; } catch (e) { s.kiyiHata = e; }
      if (s.duragan || !s.r.raf) { try { ciz(); } catch (e) {} } };
    /* three.js derleme hatasında hata fırlatmaz, yalnız konsola yazar. Çizimden sonra üç ayrı yoldan denetle:
       bağlam kaybı, three.js tanılaması, doğrudan WebGL bağlama durumu. İlk açılışta bir de gerçekten piksel çizildi mi diye bakılır */
    var saglam = function (ilk) { try { var g = renderer.getContext(); if (g.isContextLost()) return false; var pl = (renderer.info && renderer.info.programs) || []; if (!pl.length) return false;
      for (var i = 0; i < pl.length; i++) { if (pl[i].diagnostics && pl[i].diagnostics.runnable === false) return false; if (pl[i].program && !g.getProgramParameter(pl[i].program, g.LINK_STATUS)) return false; }
      if (ilk) { var px = new Uint8Array(4), w = g.drawingBufferWidth, h = g.drawingBufferHeight, top = 0, nk = [[0.5, 0.5], [0.2, 0.3], [0.8, 0.7]];
        for (var j = 0; j < 3; j++) { g.readPixels(Math.floor(w * nk[j][0]), Math.floor(h * nk[j][1]), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); top += px[0] + px[1] + px[2]; }
        if (!top && !g.isContextLost()) return false; } } catch (e) {} return true; };
    /* kalite kademesi: önce çözünürlük, sonra shader düzeyi. Hız geri gelirse bir kademe yukarı denenir */
    var kademe = function (i) { var L = AYAR.kaliteAdim; i = Math.max(0, Math.min(L.length - 1, i)); if (i === s.adim) return false; s.adim = i; s.kalite = L[i][0];
      if (s.mat.defines.KALITE !== L[i][1]) { s.mat.defines.KALITE = L[i][1]; s.mat.needsUpdate = true; s.denetle = true; } boyut(); s.isin = 0; s.top = 0; s.sayac = 0; s.iyi = 0; return true; };
    var dusur = function () { return kademe(s.adim + 1); }, yukselt = function () { return kademe(s.adim - 1); };
    /* 45 karelik ortalamaya göre karar. Yukarı deneme en çok üç kez yapılır; deneme tutmazsa o kademe tavan olur.
        Düşürmek işe yaramıyorsa (tarayıcı 30 kareye sabitlemiş ya da yavaşlık ekran kartından değil)
       boşuna kalite harcanmaz: son iki kademe geri alınır ve ayar kilitlenir */
    var olc = function (ort) { if (s.sabit || s.kilit) return;
      if (ort > 0.024) { s.iyi = 0;
        if (s.deneme) { s.deneme = false; s.tavan = s.adim + 1; s.onceki = 0; dusur(); return; }
        if (s.onceki && ort > s.onceki * 0.92) s.etkisiz++; else s.etkisiz = 0;
        if (s.etkisiz >= 2) { s.kilit = true; kademe(s.adim - 2); return; }
        s.onceki = ort; if (!dusur()) s.onceki = 0;
      } else { s.onceki = 0; s.etkisiz = 0; if (s.deneme && ++s.iyi >= 3) { s.deneme = false; s.iyi = 0; }
        else if (!s.deneme && ort < 0.0185 && s.adim > s.tavan && s.yuk < 3 && ++s.iyi >= 12) { s.iyi = 0; s.yuk++; s.deneme = true; yukselt(); } } };
    var ertele = function () { clearTimeout(s.zam); s.zam = setTimeout(function () { if (st !== s) return; boyut(); kiyi(); }, 120); };
    /* bağlam kaybı: eski denize dön; harita hâlâ sayfadaysa en çok iki kez yeniden dene. Sekme arkadaysa öne gelmesini bekle */
    s.kayip = function (e) { e.preventDefault(); dur(); if (yeniden >= 2) return; yeniden++;
      var b = { zam: 0, gor: null }, dene = function () { if (bek !== b) return; if (st || !H.isConnected) { bekIptal(); return; }
        if (document.hidden) { if (!b.gor) { b.gor = function () { if (!document.hidden) { document.removeEventListener('visibilitychange', b.gor); b.gor = null; b.zam = setTimeout(dene, 400); } }; document.addEventListener('visibilitychange', b.gor); } return; }
        bekIptal(); try { baslat(H); } catch (e2) {} };
      bek = b; b.zam = setTimeout(dene, 1500); };
    cv.addEventListener('webglcontextlost', s.kayip);
    s.r.off = function () { if (st === s) dur(); };
    s.dusur = dusur; s.yukselt = yukselt; s.boyut = boyut; s.kiyi = kiyi; s.ciz = ciz; s.olc = olc; s.saglam = saglam;

    try { boyut(); kiyi(); ciz(); if (!saglam(true)) throw 0; } catch (e) { dur(); return false; }
    H.classList.add('dz'); if (typeof RUN !== 'undefined') RUN.push(s.r);

    /* görsel sonradan yüklenir ya da değişirse harita yenilenir (yüklenmiş olanlar da dinlenir: görsel kaynağı değişebilir) */
    var gor = H.querySelectorAll('.h2-ada>img');
    for (var i = 0; i < gor.length; i++) { gor[i].addEventListener('load', ertele); s.dinle.push([gor[i], ertele]); }
    try { s.ro = new ResizeObserver(ertele); s.ro.observe(H); } catch (e) {}
    try { s.io = new IntersectionObserver(function (es) { s.gorunur = es[es.length - 1].isIntersecting; if (s.uyan) s.uyan(); }); s.io.observe(H); } catch (e) {}
    /* harita sayfadan sessizce kaldırılırsa (çizim dururken de) kaynakları bırak */
    s.bekci = setInterval(function () { if (st !== s) return; if (!cv.isConnected) dur(); }, 2000);

    s.duragan = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (s.duragan) return true;
    /* sekme arkadayken ya da harita ekran dışındayken döngü tümüyle durur; geri gelince uyan() yeniden başlatır */
    var kare = function (now) {
      s.r.raf = 0; if (!s.canli) return;
      if (!cv.isConnected) { dur(); return; }
      if (document.hidden || !s.gorunur) { s.son = 0; return; }
      s.r.raf = requestAnimationFrame(kare);
      var ham = s.son ? (now - s.son) / 1000 : 0.016; s.son = now; s.t += Math.min(0.05, ham) * AYAR.hiz;
      if (s.isin < 30) s.isin++; else if (ham < 0.25) { s.top += ham; if (++s.sayac >= 45) { var ort = s.top / s.sayac; s.top = 0; s.sayac = 0; olc(ort); } }
      try { ciz(); if (s.denetle) { s.denetle = false; if (!saglam(false)) dur(); } } catch (e) { dur(); }
    };
    s.uyan = function () { if (st !== s || !s.canli || s.r.raf || document.hidden || !s.gorunur) return; s.son = 0; s.isin = 0; s.top = 0; s.sayac = 0; s.r.raf = requestAnimationFrame(kare); };
    document.addEventListener('visibilitychange', s.uyan);
    s.r.raf = requestAnimationFrame(kare);
    return true;
  }

  /* kıyı haritasını yeniden kur (ada yeri ya da görseli dışarıdan değiştiyse) */
  function yenile() { if (!st) return; var s = st; clearTimeout(s.zam); s.zam = setTimeout(function () { if (st === s) s.kiyi(); }, 60); }
  /* v24: ayarları toplu değiştir ve gerekeni yenile. Örnek: Deniz2.ayarla({ olcek: 1.25, derinlik: 2.5, kopukYogun: 0.8 }) */
  function ayarla(o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(AYAR, k)) AYAR[k] = o[k]; var s = st; if (!s) return;
    try { s.boyut(); } catch (e) {} s.kiyi(); }

  return { baslat: baslat, dur: dur, yenile: yenile, ayarla: ayarla, AYAR: AYAR, PAL: PAL, surum: 24, _durum: function () { return st; } };
})();
