# Siap Izin

Aplikasi Induk Asisten Izin Berusaha — **repositori masih pada tahap perencanaan**.

Repositori ini menyimpan kebutuhan produk, keputusan, hasil discovery awal dan urutan pekerjaan. Belum ada aplikasi yang dapat dijalankan, mesin rekomendasi produksi, kandidat lokasi terverifikasi atau integrasi OSS yang telah diuji. Inisialisasi dokumentasi bukan persetujuan untuk mulai development.

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
| Luas target | `5000m2`; interpretasi awal per polygon kandidat |
| Tujuan | Kesesuaian kegiatan/zona dan indikasi lahan cocok untuk kakao |
| Jalan | Preferensi pemeringkatan saja, bukan syarat gugur atau batas jarak maksimum |
| Keluaran yang dituju | Kandidat pada peta dan berkas polygon rencana |

Nilai pilot tidak menjadi aturan universal seluruh kegiatan. Toleransi luas, rubrik agronomi, jumlah kandidat serta format ekspor belum disepakati seluruhnya.

## Dokumen

- [PRD v0.5](docs/PRD.md) — visi, kebutuhan, batas produk dan kriteria penerimaan.
- [Discovery pilot kakao](docs/discovery/pilot-kakao.md) — temuan awal bersumber dan keterbatasannya.
- [Daftar keputusan](docs/decisions.md) — yang telah dipilih, usulan dan hal yang masih terbuka.
- [Roadmap dan gerbang kelulusan](docs/roadmap.md) — pekerjaan berikutnya tanpa janji waktu/biaya yang belum diukur.

## Status dan langkah berikutnya

**Tersedia:** dokumentasi, parameter pilot, ringkasan pembacaan awal katalog KBLI serta metadata/daftar kegiatan RDTR.

**Belum selesai:** audit geometri/ketentuan per lokasi, kelayakan sumber agronomi/jalan, rubrik penilaian, mockup yang disetujui, desain teknis dan development.

Urutan berikutnya: **audit data → rubrik/kontrak keluaran → mockup → finalisasi PRD dan desain teknis → persetujuan development**. Beberapa pekerjaan perencanaan dapat berjalan paralel; status detail ada pada roadmap.

## Batas hasil dan publikasi

- Polygon rencana bukan batas kepemilikan, bukti tanah tersedia, hasil survei atau jaminan izin.
- Ketersediaan/hak tanah dan realisasi bukan prasyarat menghasilkan rekomendasi rencana; kesiapan pengajuan resmi ditinjau terpisah.
- Area tanpa bukti tidak dilabeli otomatis sesuai atau dilarang; ketidakpastian harus terlihat.
- Jangan mengunggah akta/dokumen klien, identitas sensitif, kata sandi, OTP, token, cookie, sesi OSS atau hasil ekspor proyek ke repo publik.
- Snapshot mentah dan arsip kerja tidak ikut commit awal. Rujukan yang tercantum dalam dokumen bukan jaminan sumber masih live atau izin publikasi ulang datanya.
- `.gitignore` adalah pengaman tambahan, bukan pengganti pemeriksaan berkas sebelum commit.

## Penggunaan repositori saat ini

Belum ada perintah instalasi, server, dependensi aplikasi atau test suite. Dokumen dapat dibaca langsung di GitHub atau editor Markdown. Stack yang dibahas dalam PRD masih merupakan usulan, bukan implementasi yang sudah tersedia.

Perubahan cakupan harus memperbarui PRD, keputusan dan pengujian yang terkait. Persetujuan publikasi dokumentasi tidak otomatis menyetujui seluruh usulan MVP atau mengizinkan tindakan pada akun OSS.
