# Siap Izin

Aplikasi induk pendamping perizinan berusaha — **prototipe eksplorasi zona lintas-RDTR Sulawesi Tenggara**.

## Status yang sudah dibuktikan

Pada pengujian 26 Oktober 2026, aplikasi memuat **5.994 polygon sumber dari 16 rencana**, dari 6.009 fitur cocok filter; **15 geometri invalid dikarantina** tanpa perbaikan. Seluruh fitur sah digambar dan tetap berstatus **unreviewed_mapping / permission: unknown**. Bukan jumlah lokasi sesuai atau izin yang diterima.

| Cakupan | Status |
|---|---|
| Filter administratif | 17 wilayah: 15 kabupaten dan 2 kota |
| Registry sumber | 18 rencana di 11 wilayah; snapshot kurasi, bukan katalog live |
| Geometri | 16 rencana memiliki calon relasi kegiatan dan berhasil dimuat pada sesi uji |
| Rencana tanpa relasi yang dapat dipertanggungjawabkan | Wanggudu dan CBD Teluk Kendari; unknown, tidak meminjam kegiatan rencana lain |
| Wilayah tidak tercantum pada snapshot publik | Buton Selatan, Buton Utara, Kolaka Utara, Muna, Muna Barat, Kota Baubau; source ID null, bukan bukti tidak ada RDTR |
| Pemetaan exact-KBLI / ITBX seluruh bidang | Belum diverifikasi; filter kegiatan bukan izin |

[Bukti browser portabel](docs/design/province-verification.json) menyimpan hitungan, hasil pemeriksaan, status live/cache dan timestamp asli per rencana. Katalog 11 wilayah/18 rencana dibandingkan kembali dengan sumber pada 26 Oktober 2026. Data di luar polygon/rencana yang dimuat tetap belum dievaluasi.

## Visi produk

**Dokumen perusahaan → identifikasi KBLI → pemeriksaan/rekomendasi lokasi → polygon rencana → persiapan/penginputan OSS → tindak lanjut perizinan.**

Satu aplikasi modular. AI membantu membaca/menjelaskan, aturan terverifikasi dan GIS memvalidasi, manusia menyetujui keputusan penting. Kesesuaian zona, agronomi dan penerimaan resmi tetap terpisah.

Eksplorasi sekarang hanya **KBLI 01273 versi 2025 dan wilayah**, tanpa luas/jalan/kandidat. Asumsi budidaya kakao belum dikonfirmasi. Pilot kandidat 5.000 m² di Kolaka Timur/Kolaka/Konawe/Konawe Selatan, jalan sebagai preferensi, dan keluaran SHP ZIP + KML tetap modul terpisah yang belum dibangun. Toleransi/bentuk polygon dan rubrik agronomi masih terbuka.

## Menjalankan lokal

Python 3.11+, internet dan dependensi geometri diperlukan:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-prototype.txt
python tools/dev_server.py --port 8765
```

Buka `http://127.0.0.1:8765/prototype/`, pilih **Muat peta publik**. Server statis `python -m http.server` tidak menyediakan API. Server hanya bind loopback dan bukan deployment produksi. Tidak memerlukan login atau kredensial.

Pilih semua/Kosongkan mengubah draf; **Terapkan kriteria** memperbarui overlay dan ekspor. Semua rencana dengan calon kegiatan pada wilayah terapan dimuat bertahap, maksimal 3 serentak. Klik polygon/daftar menunjukkan rencana asal, ID kegiatan, field filter, sumber/timestamp dan batas bukti. ID yang sama lintas-rencana tidak saling menimpa.

**Biru putus-putus berarti relevan untuk ditelaah, bukan diizinkan.** Hasil parsial/error/unknown ditampilkan, bukan diisi geometri contoh. Cache privat per rencana berada di `private/rdtr-cache/`; label `cached_snapshot` mempertahankan waktu sumber. Fallback dibatasi satu jam dan hanya untuk kegagalan jaringan. Payload rusak/perubahan konteks tidak dilonggarkan agar tampil.

Ekspor JSON **skema 3** adalah snapshot konfigurasi/provenance, **tanpa geometri/luas/jalan/kandidat**. Pratinjau dan unduhan identik; bukan GeoJSON atau berkas siap unggah OSS.

**Catatan DNS lingkungan uji:** resolver sistem sempat gagal menemukan domain proxy. Pengguna mengizinkan Google Public DNS hanya pada proses server/uji; TLS tetap diverifikasi dan DNS sistem/hosts tidak diubah. Launcher sementara tidak dipublikasikan. Server default tetap membutuhkan DNS jaringan yang berfungsi; keberhasilan sesi tersebut tidak menjamin ketersediaan sumber terus-menerus.

## Verifikasi yang dapat diulang

```sh
python -B -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
node --check prototype/app.js
# Backend aktif dan Chromium tersedia; memakai sumber nyata:
node tests/province-browser.mjs
```

Verifikasi setelah perbaikan review: **27 tes backend offline, 15 tes Node dan 98 pemeriksaan browser** lulus. Termasuk umur fallback yang dihitung ulang setelah refresh gagal, allowlist atribut ekspor, penelusuran seluruh 5.994 fitur lewat 30 halaman dengan keyboard, serta pemilihan wilayah/penerapan/detail/penutupan melalui sentuhan seluler. Sesi final setelah koreksi umur cache memakai 1 sumber live dan 15 cached_snapshot yang sah; waktu sumber asli dan alasan cache dipertahankan per rencana. [Review independen API dan frontend](docs/design/province-review.json) lulus tanpa temuan pemblokir.

Browser memeriksa 17 wilayah individual, 16 koleksi nyata, rekonsiliasi 5.994 path SVG, detail tiap rencana, pointer/keyboard, respons rusak/terlambat, unduhan yang dibaca ulang dan viewport 1512×1100/390×844. Fixture sintetis hanya untuk tes, tidak menjadi dataset/fallback aplikasi. Kegagalan sumber/jaringan tidak boleh diganti dengan data rekaan.

Variabel uji: `CHROME_BIN`, `SIAP_IZIN_URL`, `SIAP_IZIN_TEST_OUTPUT`. Profil browser terisolasi; browser pengguna tidak ditutup/diubah. Batas 2 juta verteks per koleksi menerima data Routa sebanyak 1.877.978 verteks tanpa menghilangkan pembatasan ukuran. Pengukuran performa produksi/lintas-browser tetap terbuka.

## Dokumen

- [PRD v0.10](docs/PRD.md), [keputusan](docs/decisions.md), [roadmap](docs/roadmap.md).
- [Kontrak API/klien lintas-rencana](docs/design/province-api.md), [registry](tools/rdtr-plans.json), [bukti browser](docs/design/province-verification.json).
- [Audit sumber historis terkoreksi](docs/discovery/sultra-01273-source-audit.json): 32 sampel titik bukan izin seluruh polygon. Lasalimu 014 dikoreksi dari 015; predicate geometri sama dan respons titik asli dibaca ulang.
- [Filter 17 wilayah](docs/design/region-filter.md), [riwayat pilot 20 polygon Tirawuta](docs/design/zone-overlay.md), [riwayat antarmuka](docs/design/mockup.md).
- [Discovery kandidat kakao](docs/discovery/pilot-kakao.md), [audit delapan layer awal](docs/discovery/rdtr-geometry-audit.md), [sumber agronomi/jalan](docs/discovery/data-sources.md), [rubrik usulan nonaktif](docs/design/scoring-rubric.md).

## Yang belum selesai dan batas publikasi

- Menutup 6 celah wilayah/2 relasi unknown, crosswalk exact-KBLI, matriks aturan penuh/blok, review pengguna dan izin penggunaan/redistribusi produksi.
- Agronomi bidang, kandidat/generator polygon, ekspor SHP/KML dan penerimaan OSS belum diuji. Tidak ada login atau pengajuan OSS.
- Geometri tampilan bukan batas hak, bukti tanah tersedia, hasil survei atau jaminan izin. Ketersediaan tanah/realisasi bukan prasyarat rekomendasi rencana; kesiapan pengajuan ditinjau terpisah.
- Jangan unggah dokumen klien, identitas sensitif, rahasia, OTP/token/cookie/sesi OSS atau ekspor proyek ke repo publik. Raw geodata, cache, PDF, screenshot dan launcher lingkungan tetap di luar publikasi.
- Akses publik bukan izin otomasi/redistribusi produksi. `.gitignore` bukan pengganti pemeriksaan sebelum push. Keberhasilan teknis bukan UAT produksi atau persetujuan kegiatan.
