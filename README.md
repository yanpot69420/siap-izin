# Siap Izin

Aplikasi Induk Asisten Izin Berusaha — **tahap prototipe eksplorasi zona**.

Repositori berisi PRD, audit sumber dan prototipe lokal. Sorotan geometri nyata sudah diuji untuk **satu RDTR Tirawuta**, bukan seluruh wilayah pilot. Belum ada mesin rekomendasi produksi, kandidat lokasi terverifikasi, generator polygon rencana atau integrasi OSS yang telah diuji.

## Visi

Satu aplikasi induk untuk alur:

**Dokumen perusahaan → identifikasi KBLI → pemeriksaan/rekomendasi lokasi → polygon rencana → persiapan dan penginputan OSS → tindak lanjut perizinan.**

AI membantu membaca dan menjelaskan; aturan terverifikasi dan GIS mendukung pemeriksaan; pengguna menyetujui keputusan penting. Kesesuaian zona, indikasi kesesuaian tumbuh tanaman dan penerimaan resmi diperlakukan terpisah.

## Pilot yang dipilih

| Parameter | Pilihan |
|---|---|
| KBLI input | `01273` |
| Kegiatan yang diuji | Kakao; budidaya merupakan asumsi ruang lingkup yang perlu dikonfirmasi |
| Wilayah pilot kandidat | Kolaka Timur, Kolaka, Konawe, Konawe Selatan — Sulawesi Tenggara |
| Cakupan filter eksplorasi | Seluruh 15 kabupaten dan 2 kota Sulawesi Tenggara; bukan klaim cakupan geometri seluruh wilayah |
| Luas target | `5000m2` untuk modul polygon rencana; bukan input modul eksplorasi |
| Tujuan | Kesesuaian kegiatan/zona dan indikasi lahan cocok untuk kakao |
| Jalan | Preferensi pemeringkatan saja, bukan syarat gugur atau batas jarak maksimum |
| Keluaran yang dituju | Kandidat pada peta dan polygon rencana dalam SHP ZIP + KML |

Format SHP ZIP dan KML telah dikonfirmasi. Toleransi luas, bentuk/jumlah kandidat, rubrik agronomi dan kebijakan bukti belum lengkap tetap terbuka. Nilai pilot tidak menjadi aturan universal seluruh kegiatan.

## Dokumen

- [PRD v0.9](docs/PRD.md) — kebutuhan, batas produk dan kriteria penerimaan; bukan persetujuan rilis produksi.
- [Filter seluruh kabupaten/kota](docs/design/region-filter.md) dan [32 pemeriksaan browser](docs/design/region-filter-verification.json) — 17 pilihan, kontrol massal, cakupan data dan namespace ID.
- [Discovery pilot kakao](docs/discovery/pilot-kakao.md) — pembacaan awal katalog dan kegiatan.
- [Audit geometri dan sampel ITBX](docs/discovery/rdtr-geometry-audit.md) — delapan layer; batas audit sumber versus penilaian bidang.
- [Inventaris sumber data](docs/discovery/data-sources.md) — agronomi, medan, tutupan dan jalan; uji akses serta keterbatasan resolusi.
- [Rubrik indikatif untuk review](docs/design/scoring-rubric.md) — usulan nonaktif sampai disetujui.
- [Antarmuka dan riwayat uji](docs/design/mockup.md).
- [Kontrak sorotan dan bukti integrasi](docs/design/zone-overlay.md), [hasil 18 pemeriksaan browser](docs/design/zone-overlay-verification.json) dan [API lokal](docs/design/zone-api.md).
- [Daftar keputusan](docs/decisions.md) dan [roadmap](docs/roadmap.md).

## Menjalankan prototipe lokal

Python **3.11+**, internet dan dependency geometri diperlukan. Dari root repositori:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-prototype.txt
python tools/dev_server.py --port 8765
```

Buka `http://127.0.0.1:8765/prototype/`, lalu pilih **Muat peta publik**. Hentikan server dengan Ctrl+C. Server hanya bind ke loopback; bukan deployment produksi. **Server statis `python -m http.server` tidak menyediakan API geometri.** Tidak memerlukan login atau kredensial.

Modul eksplorasi hanya memakai **KBLI dan wilayah**, tanpa luas atau preferensi jalan. Filter menyediakan seluruh **17 kabupaten/kota**, dengan **Pilih semua**, **Kosongkan**, daftar bergulir dan jumlah pilihan. Awal/reset memilih semua; kontrol massal hanya mengubah draf hingga **Terapkan kriteria**. Jika Kolaka Timur dipilih, prototipe memuat polygon filter kegiatan sumber untuk Tirawuta. Pada pengujian 25 Oktober 2026, **20 polygon P-3** tampil dan dapat diklik untuk melihat ID, dasar sorotan, atribut peraturan, waktu sumber dan batas bukti.

**Biru putus-putus berarti relevan untuk ditelaah, bukan diizinkan.** Relasi exact-KBLI belum direview, ruang lingkup budidaya belum dikonfirmasi dan ITBX seluruh bidang belum diperiksa. Tujuh rencana lainnya masih inventaris metadata, bukan sorotan zona terverifikasi. Wilayah di luar cakupan tidak dinyatakan dilarang.

API memakai sumber publik yang dibatasi, rekonsiliasi ID dan validasi topologi. Cache berada di `private/rdtr-cache/`, tidak disajikan atau diterbitkan. Cache selalu dilabeli snapshot dengan waktu sumber asli. Sumber rusak/tidak lengkap tidak diganti data contoh.

Ekspor konfigurasi berupa JSON skema v2, **tanpa geometri atau parameter kandidat**. Pencarian, pembentukan dan ekspor polygon SHP ZIP/KML tetap modul terpisah yang belum dibangun.

## Verifikasi

Dengan venv aktif:

```sh
python -B -m unittest discover -s tests -p test_zone_server.py -v
node --test tests/zone-data.test.cjs
node --check prototype/app.js
```

Hasil aktual: **11 test backend offline** dan **1 test kontrak frontend** lulus. Integrasi pada Chromium terisolasi lulus **18 pemeriksaan browser**, termasuk polygon nyata, klik pada interior polygon, keyboard, perubahan filter, respons rusak/terlambat, unduhan JSON yang dibaca ulang, seluler dan pemulihan CDN. Ini bukan UAT seluruh produk, pengujian lintas browser atau penerimaan OSS.

Probe sumber tanpa fallback dapat dijalankan terpisah dengan `python -B tools/dev_server.py --probe-live`; memerlukan internet dan melakukan permintaan baru ke sumber resmi. Rincian batas/provenance ada pada dokumentasi API.

## Status dan gerbang berikutnya

**Tersedia:** PRD v0.9, filter seluruh kabupaten/kota dengan 32 pemeriksaan browser lulus, audit RDTR terbatas, inventaris sumber, rancangan rubrik, prototipe eksplorasi dan sorotan nyata satu rencana. Review pengguna belum dianggap selesai hanya karena tes teknis lulus. Pilihan tanpa inventaris tidak dianggap tanpa RDTR atau dilarang; ID GISTARU yang belum ditemukan tetap null dengan kunci internal eksplisit pada ekspor.

**Berikutnya:** telaah relasi exact-KBLI dan ketentuan Tirawuta sebelum menerbitkan indikasi kesesuaian terverifikasi; perluas rencana secara bertahap dengan validasi yang sama. Pembacaan aturan lengkap, analisis agronomi, persetujuan parameter/rubrik, kandidat, generator GIS, desain produksi dan otomasi OSS belum selesai.

## Batas hasil dan publikasi

- Geometri sumber untuk tampilan bukan batas kepemilikan, bidang proyek, bukti tanah tersedia, hasil survei atau jaminan izin.
- Ketersediaan/hak tanah dan realisasi bukan prasyarat rekomendasi rencana; kesiapan pengajuan resmi ditinjau terpisah.
- Jangan mengunggah dokumen klien, identitas sensitif, rahasia, OTP, token, cookie, sesi OSS atau ekspor proyek ke repo publik.
- Snapshot mentah, cache, PDF sumber, screenshot dan arsip kerja tetap di luar publikasi. Bukti lama di `prototype/test-output/` juga diabaikan Git; ringkasan portabel tersedia pada dokumentasi.
- Akses publik bukan izin publikasi ulang data atau integrasi produksi. `.gitignore` bukan pengganti pemeriksaan sebelum commit.
- Leaflet serta backend lokal ini merupakan pembuktian implementasi kecil, bukan penetapan seluruh stack produksi. Mandat kelanjutan bukan izin pengajuan OSS, penggunaan data klien atau layanan berbayar.
