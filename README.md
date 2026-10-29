# Siap Izin

Aplikasi induk pendamping perizinan berusaha — **prototipe eksplorasi zona lintas-RDTR Sulawesi Tenggara**.

## Cakupan dan batas bukti

**Checkpoint lokal 29 Oktober 2026:** **16 rencana/5.994 fitur valid sudah aktif**, dengan 17.982 baris LOD tiga tingkat; rilis dua rencana sebelumnya tetap disimpan. Cakupan hanya KBLI **01273/2025**. Publikasi checkpoint ini hanya kode, tes dan dokumentasi; database, arsip sumber, kredensial dan geometri tidak ikut didistribusikan. [Status terkini dan batas verifikasi](docs/design/exploration-01273-checkpoint.md), [checkpoint publikasi sebelumnya](docs/design/local-release-checkpoint.md).

Dataset pembanding 26 Oktober 2026 mencatat **5.994 fitur sumber valid dari 16 rencana**, dari 6.009 cocok filter; **15 geometri invalid dikarantina** tanpa repair. Inventaris sumber tetap lengkap, tetapi layer yang sedang tergambar mengikuti area dan zoom. Semuanya **unreviewed_mapping / permission: unknown**, bukan jumlah lokasi sesuai atau izin diterima.

| Cakupan | Status |
|---|---|
| Filter administratif | 17 wilayah: 15 kabupaten dan 2 kota |
| Registry sumber | 18 rencana di 11 wilayah; snapshot kurasi, bukan katalog live |
| Relasi kegiatan yang dapat diminta | 16 rencana; bukan pemetaan exact-KBLI yang telah direview |
| Relasi belum tersedia | Wanggudu dan CBD Teluk Kendari; tidak meminjam kegiatan rencana lain |
| Wilayah tidak tercantum pada snapshot | Buton Selatan, Buton Utara, Kolaka Utara, Muna, Muna Barat, Kota Baubau; source ID null bukan bukti tidak ada RDTR |
| Exact-KBLI / ITBX seluruh bidang | Belum diverifikasi; filter kegiatan bukan izin |

[Bukti checkpoint sebelum optimasi](docs/design/province-verification.json) mempertahankan hitungan dan timestamp sumber sesi tersebut. Katalog dibandingkan kembali dengan sumber pada 26 Oktober 2026; ini bukan klaim discovery katalog live setiap halaman dibuka. Area di luar polygon belum dievaluasi.

## Peta yang lebih ringan

- Overview memuat inventaris semua rencana terpilih; daftar keyboard tetap dapat menelusuri seluruh fitur melalui pagination, bukan hanya fitur dalam viewport.
- Level tampilan overview/regional/detail memakai parameter generalisasi **100/10/1 meter**. Parameter ini **bukan ketelitian survei atau jaminan deviasi maksimum**. Source geometry tidak diganti untuk analisis, luas atau ekspor.
- Coverage-aware simplification hanya pada kelompok yang aman. Pada dataset pembanding, 11 rencana disederhanakan dan 5 mempertahankan koordinat asli karena coverage tidak valid. Tidak melakukan repair/dissolve atau menghilangkan fitur diam-diam.
- [Validasi geometri melalui 48 respons HTTP](docs/design/map-display-verification.json): overview 323.589 verteks dan **15.946.932 byte body HTTP**, dibanding 2.527.359 verteks dan 104.586.993 byte sebelumnya. Pengurangan byte **84,75%** bukan dengan sendirinya bukti loading browser/latensi sumber lebih cepat.
- Sorotan biru mengikuti zoom; seleksi/hover lebih tegas tanpa garis internal putus-putus yang mendominasi overview. Biru tetap relevansi untuk ditelaah, **bukan diizinkan**.
- Setelah peta disetujui, **Terapkan kriteria langsung memusatkan sorotan**, tanpa wajib memilih daftar RDTR. Lingkaran emas pada overview adalah navigasi per wilayah dengan sumber valid; klik/sentuh/Enter/Space memperbesar area sumber, bukan batas kabupaten penuh. Penanda memakai metadata inventaris, tanpa library/minimap baru, dan tidak dihitung sebagai fitur zona. [Kontrak navigasi](docs/design/map-region-navigation.md).
- Setelah geser/zoom, permintaan dibatasi pada rencana yang berpotongan dengan area peta, dengan debounce/revision guard dan transport bersama maksimum 3 request. Respons area tidak melakukan fit-bounds ulang.
- Overview lokal dapat memakai batch yang diumumkan server; setiap request tetap memeriksa seluruh anggota rilis secara segar. Inventaris terpin dapat digunakan ulang tanpa request area hanya ketika bounds sumber aslinya sepenuhnya tercakup viewport. Tidak ada perpanjangan TTL/fallback legacy atau perubahan metadata sumber.
- Atribut detail diminta menurut pasangan plan/OID dan snapshot sumber. Perubahan snapshot meminta reload, bukan memasangkan gambar lama dengan atribut baru.
- Katalog, sumber tersedia, overview dimuat, dan layer tergambar memiliki counter terpisah. Hasil nol pada viewport bukan bukti tidak ada RDTR atau kegiatan dilarang.

Leaflet tetap dipakai. Perbandingan SVG/Canvas memakai geometri dan skenario sama; vector tiles/MapLibre bukan migrasi otomatis. [Rencana dan gerbang optimasi](docs/design/map-performance-plan.md), [kontrak API tampilan](docs/design/map-display-api.md), [baseline terukur](docs/design/map-performance-baseline.json).

## Visi produk

**Dokumen perusahaan → identifikasi KBLI → pemeriksaan/rekomendasi lokasi → polygon rencana → persiapan/penginputan OSS → tindak lanjut perizinan.**

Satu aplikasi modular. AI membantu membaca/menjelaskan, GIS/aturan memvalidasi, manusia menyetujui keputusan penting. Kesesuaian zona, agronomi dan penerimaan resmi tetap terpisah.

Eksplorasi hanya **KBLI 01273 versi 2025 dan wilayah**, tanpa luas/jalan/kandidat. Asumsi budidaya kakao belum dikonfirmasi. Pilot kandidat 5.000 m² di empat kabupaten, jalan sebagai preferensi, dan keluaran SHP ZIP + KML tetap modul terpisah yang belum dibangun; toleransi/bentuk dan rubrik masih terbuka.

## Menjalankan lokal

Python **3.12+**, GEOS3.12+, internet dan dependensi berikut diperlukan. Pin pyproj3.8.0 membutuhkan Python3.12+; wheel Shapely yang digunakan pada pengujian menyertakan GEOS yang mendukung coverage.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-prototype.txt
```

### Jalur database lokal — integrasi yang diuji saat ini

Memerlukan PostgreSQL/PostGIS, konfigurasi koneksi privat dengan akun **reader terpisah**, serta rilis dataset lokal yang sudah disiapkan dan diaktifkan operator. Clone repo tidak menyertakan database atau arsip sumber dan tidak otomatis membuat rilis. Lihat [fondasi database](docs/design/rdtr-db-foundation.md) dan [kontrak baca lokal](docs/design/rdtr-local-read-contract.md).

```sh
python -m pip install -r requirements-rdtr-db.txt
python tools/rdtr_local_server.py --port 8769
```

Buka `http://127.0.0.1:8769/prototype/`, pilih **Muat peta publik**, lalu **Terapkan kriteria**. Akun aplikasi hanya membaca database; tidak ada fallback ke owner atau ATR/BPN. Konfigurasi/rilis tidak tersedia menghasilkan error eksplisit, bukan data contoh.

### Jalur legacy/live — terpisah, bukan bukti kelulusan jalur lokal

```sh
python tools/dev_server.py --port 8765
```

Buka `http://127.0.0.1:8765/prototype/`. Jalur ini membutuhkan jaringan ke sumber dan masih memiliki batas live yang dicatat di roadmap. Tidak perlu login OSS. Kedua server hanya bind loopback, bukan deployment produksi; server statis `python -m http.server` tidak menyediakan API.

Pilih semua/Kosongkan mengubah draf; **Terapkan kriteria** memperbarui inventaris/overlay dan ekspor. Klik polygon atau daftar untuk sumber, aktivitas/filter, timestamp dan batas bukti. ID sama lintas-rencana tidak saling menimpa.

Cache sumber privat per rencana berada di `private/rdtr-cache/`. Label `cached_snapshot` mempertahankan waktu sumber asli; cache turunan tidak memperpanjang TTL/stale sumber. Fallback jaringan harus berumur **kurang dari satu jam**; payload rusak/perubahan konteks tidak dilonggarkan. API original `/api/zones` tetap tersedia, tetapi klien tampilan tidak memakai endpoint penuh sebagai fallback.

Ekspor JSON **skema3** adalah snapshot konfigurasi/provenance, **tanpa geometri/luas/jalan/kandidat**. Pratinjau dan unduhan identik; bukan GeoJSON/berkas siap unggah OSS. Field historis `highlightedFeatureCount` adalah alias inventaris dimuat; gunakan `drawnFeatureCount` untuk layer saat ini.

**DNS lingkungan uji:** pengguna mengizinkan resolver publik khusus proses server/uji ketika DNS proxy gagal. TLS tetap diverifikasi; DNS sistem/hosts tidak diubah. Launcher sementara tidak dipublikasikan. Server default memerlukan DNS jaringan yang berfungsi.

## Verifikasi yang dapat diulang

Suite Python penuh memerlukan konfigurasi privat development/test serta PostGIS yang sesuai; fixture SQL hanya boleh memakai database uji terisolasi, bukan database pengembangan. Bukti browser/oracle sumber tetap privat. Checkpoint terakhir: **203 Python, 111 Node, 38 pemeriksaan browser lokal lulus**, memverifikasi 5.994 ID pada 16 rencana aktif; bukan sertifikasi produksi atau kesesuaian izin. Dua review independen lulus; backup/restore dan rollback terisolasi diuji nyata. [Hasil dan batas pengukuran](docs/design/exploration-01273-checkpoint.md), [operasi privat](docs/design/rdtr-operations.md).

```sh
# Di virtualenv yang dependensinya telah dipasang:
python -B -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
node --check prototype/app.js
node --check prototype/display-data.js
```

Tes browser baru memerlukan Chromium, backend terintegrasi dan oracle sumber privat yang diperoleh secara sah. Untuk replay terkontrol, sumber harus dibekukan byte-exact; banner `benchmark_replay`, status `cached_snapshot` dan timestamp asli tetap wajib. Replay **bukan fallback produksi** dan tidak merelaksasi TTL aplikasi.

```sh
# Terminal1, backend uji non-8765; semua path contoh harus diisi sendiri:
python tests/map-performance-replay.py --port 8767 \
  --cache-dir /absolute/private/frozen-source \
  --manifest /absolute/private/results/replay-manifest.json

# Terminal2, profil Chrome terisolasi; output di luar repo:
SIAP_IZIN_URL=http://127.0.0.1:8767/prototype/ \
SIAP_IZIN_SOURCE_DIR=/absolute/private/frozen-source \
SIAP_IZIN_TEST_OUTPUT=/absolute/private/browser-results \
SIAP_IZIN_PYTHON="$(command -v python)" \
SIAP_IZIN_RENDERER=svg node tests/display-browser.mjs
```

Variabel tambahan: `CHROME_BIN`, `TMPDIR` untuk scratch, serta `SIAP_IZIN_MODE=live` hanya untuk pengujian sumber aktif yang eksplisit. Oracle baseline mengharapkan ID dataset pembanding; perubahan sumber harus diselidiki, bukan dipaksa cocok. Browser pengguna tidak ditutup/diubah. Fixture sintetis hanya untuk unit/error injection, tidak menjadi dataset/fallback aplikasi.

`tests/province-browser.mjs` adalah harness historis checkpoint original `d72e21a`, **bukan** acceptance antarmuka viewport baru. Bukti 27 backend/15 Node/98 browser pada checkpoint tersebut tidak dihitung sebagai kelulusan optimasi. Pengukuran performa lintas-browser/deployment produksi tetap terpisah.

## Dokumen

- [PRD v0.15](docs/PRD.md), [keputusan](docs/decisions.md), [roadmap](docs/roadmap.md).
- [API tampilan/detail](docs/design/map-display-api.md), [validasi geometri](docs/design/map-display-verification.json), [baseline](docs/design/map-performance-baseline.json).
- [Kontrak sumber original](docs/design/province-api.md), [registry](tools/rdtr-plans.json), [review checkpoint sebelumnya](docs/design/province-review.json).
- [Audit sumber historis terkoreksi](docs/discovery/sultra-01273-source-audit.json): sampel titik bukan izin seluruh polygon.
- [Discovery kandidat](docs/discovery/pilot-kakao.md), [sumber agronomi/jalan](docs/discovery/data-sources.md), [rubrik usulan nonaktif](docs/design/scoring-rubric.md).

## Batas publikasi dan pekerjaan terpisah

- Enam celah wilayah/dua relasi unknown, crosswalk exact-KBLI, aturan penuh/blok, review pengguna dan izin redistribusi produksi belum selesai.
- Agronomi bidang, kandidat/generator polygon, ekspor SHP/KML dan penerimaan OSS belum diuji. Tidak ada login/pengajuan OSS.
- Geometri tampilan bukan batas hak, bukti tanah tersedia atau hasil survei. Ketersediaan tanah/realisasi bukan prasyarat rekomendasi rencana; kesiapan pengajuan ditinjau terpisah.
- Jangan unggah dokumen klien, identitas sensitif, rahasia, OTP/token/cookie/sesi OSS atau ekspor proyek ke repo publik. Raw geodata, cache, screenshot dan launcher lingkungan tetap privat.
- Akses publik bukan izin otomasi/redistribusi produksi. `.gitignore` bukan pengganti pemeriksaan sebelum push; keberhasilan teknis bukan UAT produksi atau persetujuan kegiatan.
