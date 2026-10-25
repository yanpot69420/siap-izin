# Daftar keputusan

**Status:** pengguna mengizinkan tahapan proyek dilanjutkan dan meminta pertanyaan jika ada keputusan penting. Audit, rancangan rubrik dan mockup dilanjutkan; hal yang dilewati pada formulir tidak dianggap disetujui. Belum ada persetujuan seluruh parameter atau tindakan pengajuan OSS.

## Keputusan dan kebutuhan yang disampaikan pengguna

| ID | Pernyataan | Status / batas |
|---|---|---|
| DEC-01 | Visi mencakup dokumen, KBLI, lokasi/RDTR, polygon, OSS dan tindak lanjut perizinan | Kebutuhan ujung ke ujung; pembagian rilis belum final |
| DEC-02 | Perencanaan dimatangkan sebelum development | Ditegaskan pengguna |
| DEC-03 | Peta awal Sulawesi Tenggara, filter KBLI dan sorotan zona relevan | Usulan eksplisit pengguna, diadopsi dalam draf; rincian data/UX belum final |
| DEC-04 | Sistem boleh mengusulkan lokasi dan membentuk polygon rencana berdasarkan kriteria | Kebutuhan pengguna; hasil tidak diklaim sebagai bidang hak atau persetujuan |
| DEC-05 | Ketersediaan tanah dan realisasi bukan tujuan utama/prasyarat mesin rekomendasi | Pemeriksaan persyaratan resmi tetap terpisah |
| DEC-06 | Pilot `01273`, Kolaka Timur/Kolaka/Konawe/Konawe Selatan, target `5000m2`, cocok kakao, keluaran peta dan polygon | Dipilih pengguna; luas per kandidat merupakan interpretasi awal, toleransi belum ditetapkan |
| DEC-07 | Kedekatan jalan hanya preferensi | Tidak ada batas maksimum jarak sebagai syarat gugur; metode dan bobot masih terbuka |
| DEC-08 | Inisialisasi repo dengan dokumen perencanaan dan commit/push awal | Disetujui pengguna; tanpa development aplikasi |
| DEC-09 | Lanjutkan tahapan proyek dan tanyakan hal penting yang belum pasti | Disetujui pengguna setelah commit awal; bukan izin pengajuan OSS, penggunaan data klien atau layanan berbayar |
| DEC-10 | Keluaran SHP dalam ZIP dan KML | Dikonfirmasi melalui formulir; kontrak atribut/unggah masih perlu diuji |

## Usulan yang belum otomatis disetujui

| ID | Usulan | Keputusan yang dibutuhkan |
|---|---|---|
| PROP-01 | Aplikasi web induk modular | Finalisasi bentuk/ruang penggunaan dan scope rilis |
| PROP-02 | Penggunaan awal internal | Pengguna, peran, volume dan akses |
| PROP-03 | MVP paket siap input OSS, otomasi eksternal menyusul | Persetujuan batas MVP; jangan menghilangkan visi ujung ke ujung |
| PROP-04 | Next.js, FastAPI, PostgreSQL/PostGIS, worker dan kandidat Playwright | Desain teknis setelah risiko data/integrasi diperiksa |
| PROP-05 | Kontrak/skema ekspor SHP ZIP serta KML | Format sudah dikonfirmasi DEC-10; atribut, validasi dan kecocokan target belum final |
| PROP-06 | Review manusia, bukti per temuan dan status unknown yang eksplisit | Alur dan kewenangan persetujuan perlu ditetapkan |

## Pertanyaan yang masih terbuka

- Ruang lingkup pilot budidaya kakao atau produksi benih; asumsi kerja saat ini budidaya.
- Toleransi luas, polygon utuh/multipart dan jumlah kandidat.
- Rubrik agronomi, sumber dan skala bukti yang cukup untuk bidang `5000m2`.
- Definisi tutupan yang diinginkan, status kawasan yang relevan, serta cara menangani kondisi bersyarat/unknown.
- Metode/kelas jalan dan bobot preferensi; **tidak meminta ulang batas jarak maksimum**.
- Pengguna, volume, kewenangan reviewer dan skenario pengurusan awal/perubahan.
- Kebijakan data/cloud/AI, retensi, anggaran dan batas rilis.
- Ketersediaan serta izin penggunaan sumber data dan kelayakan integrasi OSS.

Pada formulir terakhir, pengguna melewati konfirmasi ruang lingkup budidaya, usulan polygon utuh/toleransi ±1m2, dan kebijakan menampilkan kandidat ketika agronomi belum lengkap. Ketiganya tetap terbuka; tidak ada persetujuan implisit dan tidak ditanyakan ulang dalam putaran yang sama. Pekerjaan audit sumber dan rancangan layar yang tidak bergantung pada jawabannya tetap dapat berjalan.

## Bahan review yang sudah tersedia

- [Audit geometri dan sampel ITBX](discovery/rdtr-geometry-audit.md): audit sumber, bukan persetujuan kegiatan/lokasi.
- [Matriks sumber data](discovery/data-sources.md): akses, resolusi, lisensi dan celah; analisis penuh belum dilakukan.
- [Rubrik usulan](design/scoring-rubric.md): pemisahan zona/agronomi/jalan; ambang nonaktif sampai direview.
- [Mockup interaktif](design/mockup.md): alur dapat diuji tanpa kandidat palsu; belum disetujui pengguna.

Register lengkap dan stable ID kebutuhan tersedia di [PRD](PRD.md), bagian 3 dan 16. Jawaban baru memperbarui register, persyaratan, alur dan uji yang terdampak; jangan hanya ditambahkan pada catatan akhir.
