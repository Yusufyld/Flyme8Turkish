# Deniz2 v23 → v24 raporu

Bu klasör bağımsız v24 sürümünü içerir. **Sitenin koduna (`site/index.html`) dokunulmadı.**

| Dosya | Ne |
|---|---|
| `deniz2-v24.js` | Geliştirilmiş tam kod (v23 ile aynı yere, aynı arayüzle oturur) |
| `kareler/` | v23 ve v24 karşılaştırma görüntüleri (telefon, tablet, sabah, akşam) |
| `test/` | Bağımsız test betikleri |

Bir düzeltme: talimatta "Deniz2 henüz ana oyuna entegre edilmedi" yazıyor. Sitede v21'den beri bir Deniz2 bağlı (`yolculukBagla()` içinde `Deniz2.baslat(H)`). Bağlı olmayan, bekleyen v23'tür. v24 de aynı şekilde bekliyor.

---

## 1. v23 teknik analizi

Kod eksiksiz geldi; okunamayan ya da tahmin edilen satır yok. v23, gerçek three.js r128 ile başsız tarayıcıda çalıştırılıp ölçüldü.

**A. Gerstner dalgaları**
- Diklik toplamı 0,28: yüzey katlanmıyor, kırışma yok. Genlikler dengeli.
- Hızlar derin su bağıntısına yakın ama kısa dalgalar yüzde 5–17 fazla hızlı.
- Yönler pusulanın dört yanına dağılmış; 1. ve 4. dalga neredeyse karşılıklı gidiyor. Bu, ilerleyen dalga yerine yerinde salınan (duran dalga) görüntüsü verir.
- Ağ 40 × 56 sabit. Dik telefonda hücre yaklaşık 11 × 17 px, yeterli. Yatay tablette yatay hücre 32 px'e çıkıyor; en kısa dalgaya 4 hücre düşüyor, eğim kaba aktarılıyor.
- Taşma payı sabit yüzde 5. Varsayılan dalga gücünde yeterli (en çok 13 px kayma, telefonda 19 px pay). `AYAR.dalga` 1,5'in üstüne çıkarsa telefonda pay yetmeyebilir.
- **Köşe ve parça shader'ı tutarsız:** büyük dalganın eğimi normale ters işaretle ekleniyor. Küçük dalgacıklar doğru yönde, büyük dalga ters yönde aydınlanıyor.
- Üstten bakışta dalga hareketi zayıf algılanıyor; görünen hareketin çoğu parıltı beneklerinden geliyor.

**B. Kıyı haritası**
- Şeffaflık okuma, adaların birleştirilmesi, `data-kiyi="tam"` ve `taban` davranışı doğru.
- `flipY`, `gl_FragCoord`, tuval boyutu ve piksel oranı ilişkisi doğru; harita ekranla hizalı.
- Yüklenmemiş görsel atlanıyor, yüklenince harita yenileniyor. Doğru.
- `getImageData` güvenlik hatası yakalanıyor, ada elipse düşüyor. Ancak tuval bir kez kirlenince **sonraki bütün adalar** da okunamıyor.
- **Hiza hatası:** ilk harita, `.dz` sınıfı eklenmeden önce kuruluyor. O anda ada görselleri hâlâ "yüzme" animasyonunda (5 px yukarı aşağı). Harita o anki konuma göre kuruluyor, sonra animasyon duruyor. Köpük adadan kayık kalıyor.
- Harita ölçeklenirse (CSS `transform`) ya da kenarlığı olursa hiza bozuluyor.
- Uzaklık dönüşümü yaklaşık (1 / 1,41 adımlı). Eş uzaklık çizgileri sekizgen çıkıyor, hata yüzde 8'e varıyor. Köpük halkalarındaki köşeli görünümün kaynağı bu.
- Ada yalnız yer değiştirirse (boyut değişmeden) kendiliğinden yenilenmiyor; `yenile()` çağrılmalı. Bu v24'te de böyle.

**C. Köpük**
- Kıyı şeridi adanın çevresinde neredeyse kesintisiz beyaz kontur çiziyor.
- Yürüyen çizgiler eşit aralıklı ve sabit hızlı; mekanik halka görünümü veriyor.
- Çizgilerin kıyıya varışı ile şeridin genişlemesi arasında bağ yok.

**D. Su altı ışık ağı (`agisik`)**
- Sıfıra bölme çökme üretmiyor ama sonuç sonsuz değere dayanıyor; bu her ekran kartında aynı davranmaz.
- **Ölçek hatası:** ağın gözleri 200–300 px büyüklüğünde ve silik. Ekranda "ışık ağı" diye görünen şey aslında güneş parıltısı benekleri.
- Parıltı benekleri ekranın neredeyse tamamına yayılmış ve iri.
- En düşük kalite (0) ile bir üstü (1) arasındaki maliyet farkı çok küçük.

**Performans ve hata yönetimi**
- Kalite yalnız düşüyor, hiç yükselmiyor.
- Tarayıcı 30 kareye sabitlemişse (iPhone düşük güç modu) kalite boşuna en dibe iniyor.
- Harita ekran dışındayken çizim duruyor ama döngü saniyede 60 kez boş dönüyor.
- Kurulum yarıda kalırsa WebGL bağlamı serbest bırakılmıyor.
- "Hareketi azalt" açıkken `yenile()` haritayı kuruyor ama ekranı yeniden çizmiyor.
- Shader denetimi yalnız three.js'in kendi tanılamasına bakıyor.

## 2. Bulunan hatalar ve riskler (önem sırasıyla)

| # | Sorun | Oyuna etkisi | v24 |
|---|---|---|---|
| 1 | İlk kıyı haritası ada yüzerken kuruluyor | Köpük ve sığ su adadan 5 px'e kadar kayık. Testte kara maskesinin 4.100 pikseli yer değiştirdi | Düzeldi (0 piksel) |
| 2 | Işık ağı ölçeği yanlış, parıltı her yere yayılmış | Deniz "beyaz benekli" ve kalabalık görünüyor, sığ/derin ayrımı kayboluyor | Düzeldi |
| 3 | Büyük dalganın eğimi ters işaretli | Dalganın yanlış yüzü parlıyor; geometri ile ışık uyuşmuyor | Düzeldi |
| 4 | Uzaklık dönüşümü yaklaşık | Köpük halkaları köşeli | Tam Öklid dönüşümü |
| 5 | Kesintisiz köpük konturu, eş aralıklı halkalar | Yapay görünüm | Yeniden dengelendi |
| 6 | Kalite geri yükselmiyor; 30 kare sınırında dibe iniyor | Geçici bir takılma kalıcı bulanıklığa dönüyor | Düzeldi |
| 7 | Ölçekli haritada hiza bozuluyor | Şu an yok; ileride harita ölçeklenirse çıkar | Düzeldi |
| 8 | Kirlenen tuval sonraki adaları da bozuyor | Yalnız başka siteden görsel gelirse | Düzeldi |
| 9 | Yatay tablette ağ kaba | Dalga ışığında hafif basamak | Aynı bütçe, oranlı dağıtım |
| 10 | Yarım kurulumda bağlam sızıyor | Çok seyrek; tekrarlanırsa WebGL açılmaz | Düzeldi |
| 11 | Güçlü dalgada kenar açılabilir | Yalnız `AYAR.dalga` > 1,5 ve dar ekranda (kuramsal; testte yakalanmadı) | Pay kendiliğinden büyüyor |
| 12 | "Hareketi azalt"ta `yenile()` çizmiyor | Eski kare ekranda kalıyor | Düzeldi |

## 3. v24 kodu

`deniz2-v24.js`. Yerleşim v23 ile aynı: `/* ===================== DENİZ 2` ile başlayıp `const mat = (T, c, o)` satırından önce biten bloğun yerine geçer.

Korunanlar: three.js r128, `ShaderMaterial`, tek ağ, tek çizim çağrısı, dört Gerstner dalgası, `AYAR`, `PAL`, `kiyiHaritasi(H, cv)`, `kaliteAdim`, `ResizeObserver`, `IntersectionObserver`, bağlam kaybı yönetimi, `RUN` bağlantısı, `baslat(H)`, `dur()`, `yenile()`, `_durum()`. Yeni kütüphane yok.

## 4. v23 → v24 değişiklik listesi

**Köşe shader'ı**
- Dalga yönleri baskın bir yöne (sağ-üst) toplandı, ±40 derece yelpaze, en kısası çapraz çırpıntı. Karşılıklı giden çift kalmadı.
- Hızlar derin su bağıntısına tam oturtuldu.
- Eğim gerçek Gerstner eğimi olarak veriliyor: `e / (1 − diklik)`.
- `uTasma` iki eksenli oldu; pay dalga gücüne göre kendiliğinden büyüyor.

**Parça shader'ı**
- Büyük dalganın eğimi doğru işaretle normale giriyor. `EGIM` yalnız görsel abartı olarak ayrıca adlandırıldı.
- Küçük dalgacıklar türevli gürültüyle hesaplanıyor: 9 gürültü okuması yerine 3 (düşük kalitede 2).
- Gürültü katları birbirine göre döndürülüyor; kareli doku seçilmiyor.
- Işık ağı ölçeği düzeltildi; bölme tek bölmeye indi, payda sıfır olamıyor.
- Işık ağı sığda ince ve belirgin, derinde iri ve silik.
- Fresnel ayrı, yumuşak bir normalle hesaplanıyor; haritanın üstüne doğru hafifçe artıyor.
- Güneş pulları küçüldü, güneş bölgesinde toplandı, dalga sırtına ve eğime bağlandı.
- Renk geçişi dört basamak: kumlu açık turkuaz → doygun turkuaz → orta mavi → koyu mavi. Hepsi `PAL` renklerinden türüyor.
- Köpük: şerit dalga varınca genişleyip çekiliyor; yer yer hiç yok; çizgiler kıyıya yaklaştıkça sıklaşıyor, bükülüyor, kopuyor; köpüğün altında süt mavisi hale var; köpük rengi güneş rengine göre hafifçe ısınıyor.

**Kıyı haritası**
- Görselin yerleşim kutusu ölçülüyor (animasyon ve büyütme ölçüye karışmıyor).
- Ölçek ve kenarlık hesaba katılıyor.
- Tam Öklid uzaklık dönüşümü.
- Kirlenen tuval yenileniyor.

**Çalışma mantığı**
- Kalite iki yönlü: hız geri gelirse bir kademe yukarı denenir (en çok üç kez; tutmazsa o kademe tavan olur).
- Düşürmek işe yaramıyorsa son iki kademe geri alınır ve ayar kilitlenir.
- Sekme arkada ya da harita ekran dışındayken döngü tümüyle durur.
- Bağlam kaybında sekme arkadaysa öne gelmesi beklenir; deneme hakkı boşa harcanmaz.
- Shader denetimi üç yoldan: bağlam, three.js tanılaması, doğrudan WebGL bağlama durumu. İlk açılışta gerçekten piksel çizildi mi diye de bakılır.
- Derinlik ve şablon tamponu kapatıldı.
- Boyut değişmediyse tuval yeniden kurulmuyor.

**Yeni ayarlar ve arayüz eki**
- `AYAR.kopukYogun` (köpük yoğunluğu), `AYAR.yansima` (gök yansıması), `AYAR.kalite` (−1 kendiliğinden, 0–5 sabit kademe).
- `AYAR.ag` artık toplam bütçe; ekran oranına göre dağıtılır.
- `Deniz2.ayarla({...})`: ayarı değiştirir, çözünürlüğü ve haritayı yeniler. `Deniz2.surum` = 24.

## 5. Shader geliştirmeleri

| Konu | v23 | v24 |
|---|---|---|
| Büyük dalga ışığı | Ters yüz parlıyor | Geometriyle aynı yüz |
| Küçük dalgacık | 3 örnek × 3 kat, sonlu fark | 1 örnek × 3 kat, gerçek türev |
| Işık ağı | 200–300 px göz, silik | 60–90 px göz, sığda belirgin |
| Yineleme | Aynı desen 480 px'te bir | Geniş gürültüyle bükülüyor |
| Güneş | İri benekler, her yerde | Küçük pullar, güneş altında, dalgayla açılıp kapanıyor |
| Köpük | Kesintisiz kontur + eş aralıklı halka | Kopuk, yoğunluğu değişen, dalgayla nefes alan |
| Kıyı rengi | İki basamak | Dört basamak + kumluk |

Yansıma hâlâ gerçek değil: gök rengi Fresnel ile karıştırılıyor. Ortam haritası ya da ikinci çizim eklenmedi. Gerçek yansıma her karede sahneyi ikinci kez çizmek demek; bu haritada yansıyacak bir gök ya da nesne olmadığı için kazancı yok, maliyeti yaklaşık iki kat.

## 6. Mobil performans

Ölçümler yazılım çiziciyle (ekran kartı yok) alındı. Mutlak süreler gerçek cihazı göstermez; yalnız oranlar anlamlıdır.

| Shader düzeyi | v23 | v24 | Fark |
|---|---|---|---|
| 2 (tam) | 150,5 ms | 147,0 ms | −%2 |
| 1 | 135,7 ms | 121,5 ms | −%10 |
| 0 | 122,9 ms | 118,2 ms | −%4 |

v24 daha çok iş yapıyor (düzgün ışık ağı, dört basamaklı renk, zengin köpük) ve yine de biraz daha ucuz.

**Ağ çözünürlüğü:** varsayılan ağ, 16 kat sık ağla karşılaştırıldı (tablet).

| | Ortalama fark (0–255) | Belirgin farklı piksel |
|---|---|---|
| v23, 40 × 56 | 0,99 | %0,71 |
| v24, 60 × 37 (aynı bütçe) | 0,52 | %0,05 |

Sonuç: ağı sıklaştırmanın görsel kazancı yok. Bütçe aynı kaldı, yalnız dağıtımı düzeldi.

**İki katmanlı ışık ağı:** ikinci katman tam kalitede yaklaşık yüzde 17 maliyet getiriyor. Katkısı derin sudaki iri, silik ağ ve yinelemenin gizlenmesi. Bu yüzden yalnız en üst düzeyde açık; cihaz zorlanınca ilk kapanan şey.

## 7. Bağımsız test

Gereken: Node.js, Playwright, Chromium, gerçek `three.min.js` r128.

```bash
# 1) bu klasörü projede bekleyen/deniz2-v24 olarak koy
# 2) test sayfalarını üret (site/index.html'e dokunmaz, kopya üzerinde çalışır)
bash bekleyen/deniz2-v24/test/kur.sh . /yol/three.min.js
# 3) proje kökünde sunucu
python3 -m http.server 8765 &
# 4) testler
cd bekleyen/deniz2-v24/test && mkdir -p cikti
node kare.js cikti    # telefon, tablet, sabah, akşam, WebGL'siz, hareketi azalt
node ek.js cikti      # WebGL1, bozuk shader, bağlam kaybı
node ek2.js cikti     # kalite kademeleri, boyut değişimi, üst üste baslat, kenar
node t24.js           # v23 ile karşılaştırma: hiza, ölçek, hız, ağ, kalite mantığı
node t24b.js          # yüzen ada hizası, güçlü dalgada kenar
```

**Geçen denetimler:** sözdizimi; üç shader düzeyinin derlenmesi; WebGL2 ve WebGL1; üç palet; bozuk shader'da eski CSS denize dönüş; WebGL yokken dönüş; bağlam kaybı ve kendiliğinden yeniden açılma; beş kez üst üste `baslat` (tek tuval, tek döngü); `dur()` iki kez; harita sayfadan kaldırılınca kaynakların bırakılması; ekran dışında döngünün durması; boyut değişimi; kenar açılması (dalga 1 ve 2,5); kalite iniş-çıkış mantığı; sabit kalite; `ayarla()`.

**Test edilemeyenler:**
- Gerçek Android tablet ve iPhone'da hız ve görüntü. Yazılım çizici gerçek ekran kartının hızını göstermez.
- Kalite iniş-çıkışı gerçek kare süreleriyle değil, benzetilmiş sürelerle denendi.
- Sekme arkadayken bağlam kaybı (iOS'ta sık olur) başsız tarayıcıda oluşturulamadı; kod yolu okunarak denetlendi.
- Yalnız orta duyarlık destekleyen eski ekran kartları.
- Başka kaynaktan gelen ada görseli (tuval kirlenmesi) gerçek bir uzak sunucuyla denenmedi.

## 8. Entegrasyonda dokunulmaması gerekenler

- `site/index.html` içindeki eski Deniz2 bloğu, `yolculukBagla()` içindeki `Deniz2.baslat(H)` çağrısı, `stop3D()` ve `RUN`.
- `.harita2.dz` altındaki CSS. v24 aynı sınıfları (`dz`, `dz-cv`) kullanır.
- `fazNow()`. v24 yalnız okur.
- `HK.genis`, `HK.dar` ada yerleşimi ve `.h2-ada` yapısı. Kıyı haritası `.h2-ada > img` düzenine bağlı.
- three.js sürümü (r128) ve `sw.js` sürümü. Entegrasyon günü `sw.js` sürümü ayrıca artırılır.
- `AYAR.kiyi` şimdilik `'taban'` kalmalı; kumsallı yeni görseller gelince `'tam'` yapılır.

Entegrasyon günü yapılacak tek değişiklik: eski bloğu `deniz2-v24.js` içeriğiyle değiştirmek. Ondan önce gerçek cihazda denenmeli.

---

## v24, v23'e göre ne sağlıyor?

**Görsel**
1. Köpük ve sığ su adayla tam hizalı (v23'te 5 px'e kadar kayıktı).
2. Gerçek bir su altı ışık ağı var; sığda belirgin, derinde silik.
3. Deniz beyaz beneklerle kaplı değil; pullar güneş bölgesinde ve dalgayla oynuyor.
4. Kıyıda dört basamaklı renk geçişi ve kumluk.
5. Köpük kesintisiz kontur ve eş aralıklı halka değil; kopuk, dalga varınca genişleyip çekiliyor.
6. Köpük halkaları yuvarlak, köşeli değil.
7. Dalgalar tek bir baskın yöne ilerliyor; doğru yüzleri parlıyor.

**Teknik**
1. Kalite iki yönlü; geçici takılma kalıcı bulanıklığa dönmüyor.
2. 30 kareye sabit cihazda kalite boşuna düşmüyor.
3. Görünmeyen denizde döngü tümüyle duruyor.
4. Shader denetimi üç bağımsız yoldan.
5. Parça shader'ı yüzde 2–10 daha ucuz.
6. Aynı ağ bütçesiyle tablette yarı yarıya daha az hata.
7. Ölçekli harita, kirlenen tuval, yarım kurulum ve güçlü dalga durumları güvenli.
