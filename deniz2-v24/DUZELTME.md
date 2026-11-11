# Deniz2 v24 – teknik düzeltme turu

Yalnız `deniz2-v24.js` düzeltildi. `site/index.html` dosyasına dokunulmadı, canlı siteye entegrasyon yapılmadı. Mimari, görsel hedef ve dış arayüz aynı.

İncelemedeki beş tespitin beşi de yerindeydi. Toplam değişiklik: 64 satır eklendi, 33 satır çıktı.

## 1. Değişen satırlar

Satır numaraları düzeltilmiş dosyaya göredir.

| Satır | Ne değişti | Madde |
|---|---|---|
| 26–27 | `AYAR.kalite` açıklaması; yeni `AYAR.kararli: 20` | 2, 4 |
| 35–37 | `sonHata` değişkeni; `kaliteOku()` işlevi | 2, 3 |
| 117 | `kumluk`: ters eşikli `smoothstep` düzeltildi | 1 |
| 141 | Shader içine kural notu | 1 |
| 155 | `serit` | 1 |
| 158–159 | `cizgi` (iki çağrı) | 1 |
| 160 | `parca` | 1 |
| 161 | `dantel` | 1 |
| 163 | süt mavisi hale | 1 |
| 224–232 | `tekrarDene(H)` modül düzeyine çıkarıldı | 4 |
| 236 | `dur()`: `sagZam` zamanlayıcısı da temizleniyor | 4 |
| 264 | `baslat`: kalite `kaliteOku()` ile okunuyor | 2 |
| 285 | `kiyi()`: çizim `guvenliCiz()` üzerinden | 3 |
| 286–303 | `saglam()` yerine `denetim()`, `bitir()`, `guvenliCiz()` | 3 |
| 319–321 | `gecmisSil()`, `kaliteAyar()` | 2 |
| 323–324 | `s.kayip` kısaldı, `tekrarDene` çağırıyor | 4 |
| 327 | Test için dışa açılan iç işlevler | – |
| 329–333 | İlk kare denetimi nedenleriyle; kararlılık zamanlayıcısı | 3, 4 |
| 353 | Kare döngüsü `guvenliCiz()` çağırıyor | 3 |
| 364–369 | `ayarla()`: kalite doğrulaması ve anında uygulama | 2 |
| 371–372 | `_tani()` eklendi | 3, 4 |

## 2. Her düzeltmenin gerekçesi

**1. `smoothstep`.** GLSL'de ilk eşik ikinciden büyükse sonuç tanımsızdır. Bildiğim sürücülerde beklenen değeri verir ama bu garanti değildir. Yedi çağrı vardı; hepsi `1.0 - smoothstep(küçük, büyük, x)` biçimine çevrildi. Matematiksel olarak aynı eğridir. Kalan 23 çağrının tamamında ilk eşik küçük.

Bu kalıp v23'te de vardı (`smoothstep(0.26, 0.0, d)` gibi) ve yayındaki v22 sitede de var. Yani yeni bir hata değil, eskiden beri taşınan bir risk.

**2. Kalite ayarı.** `ayarla({kalite: ...})` yalnız `AYAR` içine yazıyordu; çalışan deniz bunu `baslat` anında bir kez okuyordu. Şimdi:
- `kaliteOku()` değeri tek yerde yorumlar: eksi → −1 (kendiliğinden), fazlası son kademeye sıkıştırılır, kesirli değer yuvarlanır.
- `kaliteAyar()` kademeyi, sabit/kendiliğinden durumunu, shader düzeyini ve çözünürlüğü birlikte günceller, ölçüm geçmişini siler.
- `ayarla()` sayı olmayan kalite değerini yok sayar (`'abc'`, `NaN`, `null`, `Infinity`, `'2'`).
- `Deniz2.AYAR.kalite = 1` diye doğrudan yazılırsa da sonraki karede uygulanır.
- Sabitten kendiliğinden moda geçince kademe olduğu yerde kalır, ölçüm sıfırdan başlar.

**3. Hata denetimi.** `saglam()` içinde beklenmeyen bir hata olursa işlev "sağlam" dönüyordu. Yeni `denetim()` boş metin (sağlam) ya da nedeni döndürür:

| Neden | Ne zaman | Sonuç |
|---|---|---|
| `baglam` | Bağlam kayıp | Eski deniz; sınırlı sayıda yeniden denenir |
| `shader` | Derleme ya da bağlama hatası | Eski deniz; yeniden denenmez |
| `cizim` | İlk karede hiç piksel yok | Eski deniz |
| `denetim` | Denetimin kendisi hata verdi | Eski deniz |
| `kurulum`, `cizim-hatasi` | Kurulumda ya da çizimde istisna | Eski deniz |

Her durumda `dur()` çağrılır; kaynaklar bırakılır, tuval kaldırılır, `.dz` sınıfı silinir. Son neden `Deniz2._tani().sonHata` ile okunabilir. Hareketi azalt modunda da kalite değişince denetim yapılıyor (önceden yalnız kare döngüsünde vardı).

**4. Bağlam yönetimi.** Yeniden başlatma sayacı hiç sıfırlanmıyordu; sayfa açık kaldıkça iki kayıptan sonra deniz bir daha kendiliğinden açılmıyordu. Şimdi yeniden açılan deniz `AYAR.kararli` saniye (varsayılan 20) sorunsuz çalışırsa hak tazelenir.

Sayaç başarılı açılışta hemen sıfırlanmıyor, çünkü açılır açılmaz yeniden kaybeden bir cihazda bu sonsuz döngü olurdu. Böyle bir cihazda en çok iki deneme yapılır ve durur. Geriye kalan en kötü durum: 20 saniyeden uzun aralıklarla sürekli kaybeden cihaz. O her seferinde yeniden açılır; bu istenen davranıştır, sıkı döngü değildir.

**5. Performans.** Kod değişmedi; mantık daha geniş sınandı (aşağıda).

## 3. Sözdizimi

`node --check deniz2-v24.js` → temiz. Test betiklerinin yedisi de temiz.

## 4. Shader derleme

Gerçek three.js r128, başsız Chromium, yazılım çizici (SwiftShader).

| Ortam | Düzey 2 | Düzey 1 | Düzey 0 |
|---|---|---|---|
| WebGL 2.0 (OpenGL ES 3.0) | bağlandı | bağlandı | bağlandı |
| WebGL 1.0 (OpenGL ES 2.0) | bağlandı | bağlandı | bağlandı |

Altı derlemenin hepsinde bağlama durumu doğru, GL hatası yok, konsol hatası yok, piksel çiziliyor.

**Görüntü değişmedi mi:** düzeltmeden önceki ve sonraki v24 aynı anda, üç düzeyde, 999.490 pikselde karşılaştırıldı.

| Düzey | Farklı renk değeri | En büyük fark |
|---|---|---|
| 2 | 1 | 1/255 |
| 1 | 1 | 1/255 |
| 0 | 0 | 0 |

## 5. Testler (`node t24c.js`, 15 denetim, hepsi geçti)

**Kalite ayarı**
- `ayarla({kalite: 3})` → kademe 3, sabit, shader düzeyi 1, çözünürlük çarpanı 0,64, tuval 555 → 355 px.
- Sabitken yavaş ölçüm gelse de kademe değişmiyor.
- 5 ve 0 doğru uygulanıyor; 99 → 5; 2,6 → 3.
- Yedi geçersiz değerin hiçbiri ayarı değiştirmiyor.
- −1 → kendiliğinden; kilit, tavan, deneme sayısı ve önceki ölçüm sıfırlanıyor; sonraki yavaş ölçümde kademe düşüyor.
- `AYAR.kalite = 1` doğrudan yazılınca sonraki karede uygulanıyor.
- Hareketi azalt modunda: anında tek kare çiziliyor, denetleniyor, animasyon başlamıyor.

**Hata denetimi**
- Sağlam durumda boş dönüyor.
- `getContext` hata verirse `baglam`; program listesi hata verirse `denetim`; `readPixels` hata verirse `denetim`; boş kare `cizim`; bağlama başarısızsa `shader`.
- Çalışırken shader bozulursa: sonraki karede kaynaklar bırakılıyor, eski denize dönülüyor, yeniden denenmiyor.
- Bilerek bozulmuş shader'lı sayfa: `baslat` yanlış dönüyor, neden `shader`, tuval yok.
- three.js yokken sayfa hatasız.

**Bağlam kaybı**
- 1. kayıp → eski deniz, 1,5 sn sonra yeniden açılıyor (sayaç 1).
- 2. kayıp → yeniden açılıyor (sayaç 2).
- 3. kayıp → açılmıyor, bekleyen iş yok.
- Elle `baslat` yine çalışıyor; kararlı çalışınca sayaç 0'a dönüyor; sonraki kayıpta yeniden açılıyor.
- Yeniden başlatma beklerken `dur()` → iptal. `dur()` üç kez üst üste hatasız.

**Temizlik**
- Açıkken: 1 `visibilitychange`, 14 görsel `load`, 2 `webglcontextlost` dinleyicisi; 1 aralık, 1 uzun zamanlayıcı, 1 `ResizeObserver`, 1 `IntersectionObserver`.
- Beş kez üst üste `baslat` → sayılar aynı, birikme yok.
- `dur()` sonrası hepsi 0; kare isteği 0; açılan 6 WebGL bağlamının 6'sı bırakılmış; tuval yok; `RUN` boş; `.dz` yok.

**Otomatik kalite (benzetilmiş kare süreleriyle)**
- 30 kareye sabit: iki kademe iniyor, işe yaramadığını görüp başa dönüyor ve kilitleniyor.
- 60 karede hiç düşmüyor.
- Gerçekten yavaş ve düşürdükçe hızlanan cihaz: düşüyor, kilitlenmiyor.
- Başarısız yükseltme: geri iniyor, o kademe tavan oluyor, bir daha denemiyor.
- Başarılı yükseltme: üstte kalıyor.
- En çok üç yükseltme denemesi.

**Diğer**
- Ekran dışında kare isteği 0, çizim 0; geri gelince sürüyor.
- Hareketi azalt: tek kare, döngü yok.

Önceki betikler de düzeltilmiş kodla yeniden geçti: `kare.js`, `ek.js`, `ek2.js`, `t24.js`, `t24b.js`.

Not: paketteki `ek2.js` betiğinde sayfa adresi eski klasör düzeninde kalmıştı ve betik bu düzende çalışmıyordu. Düzeltildi. Hata test betiğindeydi, deniz kodunda değil.

## 6. Gerçek cihazda denenmemiş noktalar

Aşağıdakilerin hiçbiri gerçek cihazda ölçülmedi. Yukarıdaki sonuçlar yalnız başsız masaüstü Chromium ve yazılım çizici içindir.

- **Hız.** Android tablet ve iPhone'da saniyedeki kare sayısı bilinmiyor. Rapordaki milisaniye değerleri ekran kartsız ölçümdür; gerçek cihazın hızını göstermez.
- **Otomatik kalite.** İniş, çıkış ve 30 kare kilidi gerçek kare süreleriyle değil, elle verilen sürelerle sınandı. Eşiklerin (24 ms, 18,5 ms, yüzde 8) gerçek cihazda doğru yerde durup durmadığı bilinmiyor.
- **iPhone düşük güç modu.** 30 kare sınırı benzetildi; gerçek davranış görülmedi.
- **Gerçek ekran kartı sürücüleri.** Shader yalnız SwiftShader'da derlendi. Mali, Adreno, PowerVR ve Apple sürücülerinde derleme ve görüntü doğrulanmadı.
- **Orta duyarlıklı (mediump) eski cihazlar.** Işık ağı hesabı yüksek duyarlık ister; böyle bir cihazda görüntü bozulabilir.
- **Gerçek bağlam kaybı.** Kayıp, test uzantısıyla (`WEBGL_lose_context`) üretildi. iOS'un arka plandaki sekmenin bağlamını öldürmesi ve sekme arkadayken bekleme yolu gerçek cihazda görülmedi.
- **Isınma ve pil.** Uzun süre açık kalınca ne olduğu ölçülmedi.
- **Başka kaynaktan gelen ada görseli.** Tuval kirlenmesi yolu gerçek bir uzak sunucuyla denenmedi.
- **Görüntünün beğenisi.** Köpük, renk ve parıltı dengesi yalnız ekran görüntüsünde değerlendirildi; gerçek ekranda, gerçek parlaklıkta bakılmadı.
