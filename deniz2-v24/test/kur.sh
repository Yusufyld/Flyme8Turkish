#!/bin/bash
# Deniz2 v24 bağımsız test sayfalarını üretir. Sitenin kendisine (site/index.html) DOKUNMAZ; bir kopya üzerinde çalışır.
# Kullanım:  bash bekleyen/deniz2-v24/test/kur.sh <proje kökü> <three.min.js r128 dosyası>
# Beklenen düzen: <kök>/site/index.html, <kök>/araclar/test-sayfasi.py, <kök>/bekleyen/deniz2-v24/deniz2-v24.js
set -e
K="$(cd "$1" && pwd)"; T="$2"; B="$K/bekleyen/deniz2-v24"; C="$B/test/calisma"; P="$B/test/sayfa"
[ -f "$T" ] || { echo "three.min.js (r128) yolu verilmeli"; exit 1; }
mkdir -p "$C" "$P"; cp "$T" "$P/three.min.js"
yap() { # $1 = deniz2 kaynak dosyası, $2 = sayfa adı eki
  python3 -I - "$K/site/index.html" "$1" "$C/index.html" <<'PY'
import sys
s=open(sys.argv[1],encoding='utf-8').read(); m=open(sys.argv[2],encoding='utf-8').read()
a=s.index('/* ===================== DENİZ 2'); b=s.index('const mat = (T, c, o)')
open(sys.argv[3],'w',encoding='utf-8').write(s[:a]+m.rstrip('\n')+'\n\n'+s[b:])
PY
  for f in gun sabah aksam; do python3 -I "$K/araclar/test-sayfasi.py" "$C" "$P/$f$2.html" $f; sed -i 's#/araclar/three-shim.js#three.min.js#' "$P/$f$2.html"; done
}
yap "$B/deniz2-v24.js" ""
sed 's/gl_FragColor = vec4(col, 1.0);/gl_FragColor = vec4(col, 1.0) BOZUK;/' "$P/gun.html" > "$P/bozuk.html"
# karşılaştırma için v23 sayfası (varsa)
if [ -f "$K/bekleyen/deniz2-v23.js" ]; then yap "$K/bekleyen/deniz2-v23.js" "23"; rm -f "$P/sabah23.html" "$P/aksam23.html"; fi
rm -rf "$C"; echo "hazır: $P"
