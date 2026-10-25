# Siap Izin

Aplikasi Induk Asisten Izin Berusaha — **tahap discovery dan mockup perencanaan**.

Repositori berisi PRD, audit sumber dan mockup interaktif yang dapat dijalankan lokal. Belum ada mesin rekomendasi produksi, kandidat lokasi terverifikasi, generator polygon rencana atau integrasi OSS yang telah diuji. Izin melanjutkan tahapan proyek bukan persetujuan otomatis seluruh parameter atau pengajuan OSS.

## Visi

Satu aplikasi induk untuk alur:

**Dokumen perusahaan → identifikasi KBLI → pemeriksaan/rekomendasi lokasi → polygon rencana → persiapan dan penginputan OSS → tindak lanjut perizinan.**

AI membantu membaca dan menjelaskan; aturan terverifikasi dan GIS mendukung pemeriksaan; pengguna menyetujui keputusan penting. Kesesuaian zona, indikasi kesesuaian tumbuh tanaman dan penerimaan resmi diperlakukan terpisah.

## Pilot yang dipilih

| Parameter | Pilihan |
|---|---|
| KBLI input | `01273` |
| Kegiatan yang diuji | Kakao; budidaya merupakan asumsi ruang lingkup yang perlu dikonfirmasi |
| Wilayah | Kolaka Timur, Kolaka, Konawe, Konawe Selatan — Sulawesi Tenggara |
| Luas target | `5000m2` untuk modul polygon rencana; bukan input modul eksplorasi |
| Tujuan | Kesesuaian kegiatan/zona dan indikasi lahan cocok untuk kakao |
| Jalan | Preferensi pemeringkatan saja, bukan syarat gugur atau batas jarak maksimum |
| Keluaran yang dituju | Kandidat pada peta dan polygon rencana dalam SHP ZIP + KML |

Format SHP ZIP dan KML telah dikonfirmasi. Toleransi luas, bentuk/jumlah kandidat, rubrik agronomi dan kebijakan bukti belum lengkap tetap terbuka. Nilai pilot tidak menjadi aturan universal seluruh kegiatan.

## Dokumen

- [PRD v0.7](docs/PRD.md) — visi, kebutuhan, batas produk dan kriteria penerimaan.
- [Discovery pilot kakao](docs/discovery/pilot-kakao.md) — pembacaan awal katalog dan kegiatan.
- [Audit geometri dan sampel ITBX](docs/discovery/rdtr-geometry-audit.md) — delapan layer; batas audit sumber versus penilaian bidang.
- [Inventaris sumber data](docs/discovery/data-sources.md) — agronomi, medan, tutupan dan jalan; uji akses serta keterbatasan resolusi.
- [Rubrik indikatif untuk review](docs/design/scoring-rubric.md) — usulan nonaktif sampai disetujui, bukan hasil penilaian lahan.
- [Mockup dan laporan uji](docs/design/mockup.md) — alur, dependensi, bukti uji dan batas hasil.
- [Daftar keputusan](docs/decisions.md) dan [roadmap](docs/roadmap.md) — keputusan pengguna, usulan dan gerbang pelaksanaan.

## Menjalankan mockup lokal

Dari root repositori:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory prototype
```

Buka `http://127.0.0.1:8765/`. Hentikan dengan Ctrl+C. Tidak memerlukan instalasi paket atau kredensial. Peta Leaflet/OpenStreetMap hanya dimuat setelah tombol **Muat peta publik** dipilih dan memerlukan internet. Tanpa peta, filter, bukti lokal dan ekspor konfigurasi tetap dapat digunakan.

Modul eksplorasi kini hanya memakai **KBLI dan wilayah**, tanpa input luas atau preferensi jalan. Tab Zona menyatakan evaluasi/sorotan belum tersedia; filter saat ini membatasi inventaris bukti, belum menyorot zona yang terbukti sesuai. Ekspor konfigurasi memakai skema v2 khusus eksplorasi tanpa luas/parameter kandidat. Pencarian, pembuatan dan ekspor polygon berada pada modul terpisah yang belum dibangun.

## Status dan gerbang berikutnya

**Tersedia untuk review:** PRD v0.7, audit teknis terbatas RDTR, inventaris sumber dan uji akses sampel, rancangan rubrik, serta mockup eksplorasi. Laporan pengujian membedakan pemeriksaan UI dari pengujian GIS/OSS.

**Belum selesai:** pembacaan aturan lengkap dan pemetaan exact-KBLI, analisis agronomi seluruh wilayah/bidang, persetujuan rubrik/parameter, kandidat nyata, generator GIS, desain teknis produksi dan otomasi OSS.

Tahap berikutnya: **review mockup dan parameter → validasi aturan/data lanjutan → finalisasi PRD serta desain teknis → persetujuan pembangunan mesin analisis**. Belum ada janji jadwal, biaya atau peluang izin.

## Batas hasil dan publikasi

- Polygon rencana bukan batas kepemilikan, bukti tanah tersedia, hasil survei atau jaminan izin.
- Ketersediaan/hak tanah dan realisasi bukan prasyarat rekomendasi rencana; kesiapan pengajuan resmi ditinjau terpisah.
- Area tanpa bukti tidak otomatis dilabeli sesuai atau dilarang; ketidakpastian tetap terlihat.
- Jangan mengunggah dokumen klien, identitas sensitif, rahasia, OTP, token, cookie, sesi OSS atau ekspor proyek ke repo publik.
- Snapshot mentah, PDF sumber dan arsip kerja tetap di luar repo. Bukti uji lokal di `prototype/test-output/` juga tidak ikut publikasi; laporan ringkas ada pada dokumentasi mockup.
- Akses publik tidak sama dengan izin publikasi ulang data atau integrasi produksi. `.gitignore` bukan pengganti pemeriksaan sebelum commit.
- Stack produksi dalam PRD masih usulan; mockup HTML/CSS/JavaScript tidak menetapkan stack final. Perubahan cakupan harus memperbarui kebutuhan, keputusan dan uji terkait.
