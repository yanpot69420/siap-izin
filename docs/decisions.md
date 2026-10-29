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
| DEC-11 | Hapus textfield luas pada eksplorasi; tujuan modul ini hanya melihat zona sesuai KBLI pilihan | Ditegaskan pengguna. Eksplorasi hanya KBLI/wilayah; luas dan preferensi kandidat untuk modul pencarian/pembuatan polygon terpisah |
| DEC-12 | Buat filter seluruh kabupaten/kota Sulawesi Tenggara | Diminta pengguna. Seluruh 17 pilihan tersedia; geometri tidak otomatis menjadi seluruh provinsi dan pilot kandidat empat kabupaten tetap terpisah |
| DEC-13 | Lanjutkan eksplorasi KBLI 01273 terhadap seluruh sumber Sulawesi Tenggara yang tersedia | Diminta pengguna. Inventaris 18 rencana/17 wilayah; 6 wilayah tidak tercantum dan 2 rencana tanpa calon relasi. Bukan cakupan fisik seluruh provinsi atau verifikasi izin |
| DEC-14 | Kerjakan optimasi berurutan: baseline/sorotan, geometri tampilan/detail serta perbandingan SVG–Canvas, lalu pemuatan area/zoom | Disetujui Anton: “ya kerjakan sesuai urutan yang anda pilih”. Vector tiles hanya bila hasil ukur masih memerlukan; bukan izin mengganti geometri analisis atau mengklaim izin |
| DEC-15 | Resolver publik hanya untuk proses server/uji, tanpa mengubah DNS sistem | Diizinkan khusus untuk gangguan DNS sumber pada lingkungan uji. TLS tetap diverifikasi; bukan perubahan DNS/hosts sistem atau kebijakan deployment produksi |
| DEC-16 | Rancang database RDTR mandiri untuk menyimpan polygon/batas dan relasi kegiatan dari ATR/BPN; panel admin/sinkronisasi terbaru dibuat belakangan | Permintaan awal 27 Oktober 2026 adalah desain saja; tidak menjadi izin build dengan sendirinya. [Rancangan database](design/rdtr-database.md). Izin implementasi berikutnya dicatat terpisah pada DEC-17 |
| DEC-17 | Lanjutkan implementasi database lokal, impor bertahap, perbaikan review, jalur baca lokal dan integrasi peta sesuai urutan yang dibahas | Anton memberi instruksi lanjut setelah rancangan, mengonfirmasi migrasi dev, lalu “ya kerjakan sesuai urutan anda”. Tahap awal menyimpan dua subset arsip nyata, bukan seluruh layer atau pengambilan massal baru. Review/perbaikan mendahului integrasi/aktivasi lokal. Tidak mengizinkan panel admin/scheduler, publikasi internet, layanan berbayar, data klien atau pengajuan OSS. Lihat [checkpoint](design/rdtr-db-foundation.md) |
| DEC-18 | Terapkan langsung menampilkan sorotan dan gunakan lingkaran wilayah untuk navigasi yang ringan | Diminta Anton 29 Oktober 2026; klik/sentuh/keyboard memperbesar area sumber yang tersedia, bukan membuktikan batas wilayah/izin. Uji lokal dua rencana, tanpa aktivasi staging. [Kontrak](design/map-region-navigation.md) |
| DEC-19 | Publikasi kode melalui commit dan push | Instruksi eksplisit Anton 29 Oktober 2026. Mencakup kode, skema, tes dan dokumentasi yang telah diperiksa; database, konfigurasi rahasia, arsip/geometri, bukti privat, deployment produksi dan pengajuan OSS tidak ikut diizinkan. Izin ini memperbarui batas publikasi kode pada DEC-17, bukan izin redistribusi dataset. [Checkpoint](design/local-release-checkpoint.md) |

## Usulan yang belum otomatis disetujui

| ID | Usulan | Keputusan yang dibutuhkan |
|---|---|---|
| PROP-01 | Aplikasi web induk modular | Finalisasi bentuk/ruang penggunaan dan scope rilis |
| PROP-02 | Penggunaan awal internal | Pengguna, peran, volume dan akses |
| PROP-03 | MVP paket siap input OSS, otomasi eksternal menyusul | Persetujuan batas MVP; jangan menghilangkan visi ujung ke ujung |
| PROP-04 | Next.js, FastAPI, PostgreSQL/PostGIS, worker dan kandidat Playwright | PostgreSQL/PostGIS sudah dipakai untuk fondasi lokal DEC-17; tidak mengesahkan seluruh stack, deployment produksi atau panel sinkronisasi |
| PROP-05 | Kontrak/skema ekspor SHP ZIP serta KML | Format sudah dikonfirmasi DEC-10; atribut, validasi dan kecocokan target belum final |
| PROP-06 | Review manusia, bukti per temuan dan status unknown yang eksplisit | Alur dan kewenangan persetujuan perlu ditetapkan |

## Pertanyaan yang masih terbuka

- Ruang lingkup pilot budidaya kakao atau produksi benih; asumsi kerja saat ini budidaya.
- Toleransi luas, polygon utuh/multipart dan jumlah kandidat untuk modul polygon; bukan penghambat atau input eksplorasi zona.
- Rubrik agronomi, sumber dan skala bukti yang cukup untuk bidang `5000m2`.
- Definisi tutupan yang diinginkan, status kawasan yang relevan, serta cara menangani kondisi bersyarat/unknown.
- Metode/kelas jalan dan bobot preferensi; **tidak meminta ulang batas jarak maksimum**.
- Pengguna, volume, kewenangan reviewer dan skenario pengurusan awal/perubahan.
- Kebijakan data/cloud/AI, retensi, anggaran dan batas rilis.
- Ketersediaan serta izin penggunaan sumber data dan kelayakan integrasi OSS.
- Deployment/backup/retensi, kebijakan umur dataset lokal serta kewenangan aktivasi rilis DB RDTR; tidak meminta jadwal sinkronisasi sekarang karena panel tersebut ditunda.

Pada formulir terakhir, pengguna melewati konfirmasi ruang lingkup budidaya, usulan polygon utuh/toleransi ±1m2, dan kebijakan menampilkan kandidat ketika agronomi belum lengkap. Ketiganya tetap terbuka; tidak ada persetujuan implisit dan tidak ditanyakan ulang dalam putaran yang sama. Pekerjaan audit sumber dan rancangan layar yang tidak bergantung pada jawabannya tetap dapat berjalan.

## Bahan review yang sudah tersedia

### Pilihan pelaksanaan teknis — bukan keputusan parameter pengguna

Permintaan pengguna untuk melanjutkan tahap berikutnya dikerjakan sebagai pembuktian sorotan **satu RDTR Tirawuta** terlebih dahulu. Ini tidak menghapus empat kabupaten pilot, mengonfirmasi asumsi budidaya atau menetapkan stack produksi. Leaflet dipertahankan; backend lokal membatasi sumber/query, memvalidasi geometri dan menyimpan cache privat. Perluasan rencana dilakukan setelah bukti integrasi ini, bukan memakai polygon contoh.

Pada 25 Oktober 2026, 20 polygon sumber tampil dan 18 pemeriksaan browser lulus. Semuanya biru putus-putus, `unreviewed_mapping`/`unknown`; relasi exact-KBLI belum direview. [Kontrak dan hasil](design/zone-overlay.md). Keberhasilan rendering tidak dianggap persetujuan kegiatan, agronomi, bidang hak atau penerimaan OSS.

- [Audit geometri dan sampel ITBX](discovery/rdtr-geometry-audit.md): audit sumber, bukan persetujuan kegiatan/lokasi.
- [Matriks sumber data](discovery/data-sources.md): akses, resolusi, lisensi dan celah; analisis penuh belum dilakukan.
- [Rubrik usulan](design/scoring-rubric.md): pemisahan zona/agronomi/jalan; ambang nonaktif sampai direview.
- [Mockup interaktif](design/mockup.md): alur dapat diuji tanpa kandidat palsu; belum disetujui pengguna.
- [API lokal](design/zone-api.md) dan [rekaman sorotan nyata](design/zone-overlay-verification.json): pembuktian teknis satu rencana, bukan penerimaan seluruh produk.

Register lengkap dan stable ID kebutuhan tersedia di [PRD](PRD.md), bagian 3 dan 16. Jawaban baru memperbarui register, persyaratan, alur dan uji yang terdampak; jangan hanya ditambahkan pada catatan akhir.
