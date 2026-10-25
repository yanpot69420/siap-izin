# Discovery awal pilot — Kakao 01273 / Sulawesi Tenggara

**Status:** parameter utama dipilih Anton; pemeriksaan awal katalog selesai; bukan hasil pencarian kandidat lahan atau persetujuan development.

Dokumen ini mempertahankan **baseline discovery awal**; status “belum diuji” pada tabel di bawah merujuk tahap tersebut. Perkembangan terbaru ada pada [audit geometri/ITBX](rdtr-geometry-audit.md), [matriks sumber](data-sources.md), [rubrik usulan](../design/scoring-rubric.md) dan [mockup](../design/mockup.md). Tidak ada kandidat lahan atau pengujian penerimaan OSS yang dinyatakan selesai.

## 1. Parameter pilot

- KBLI input: `01273`, disimpan dengan nol awal.
- Wilayah: Kolaka Timur, Kolaka, Konawe, Konawe Selatan.
- Luas target: `5000m2`; interpretasi awal per polygon kandidat, bukan total dibagi empat kabupaten.
- Tujuan: indikasi lahan cocok untuk kakao dan kegiatan/zona sesuai.
- Keluaran: kandidat di peta dan berkas polygon rencana.
- Bukan prasyarat rekomendasi: tanah siap transaksi, bukti hak atau realisasi usaha.
- Asumsi yang belum dikonfirmasi: kegiatan budidaya, bukan produksi benih.
- Keputusan terbaru Anton: kedekatan jalan hanya preferensi pemeringkatan, tanpa batas maksimum sebagai syarat gugur; data jalan yang belum diketahui bukan jarak nol.

## 2. Temuan yang benar-benar diperoleh

Halaman OSS mengidentifikasi `01273` sebagai **Pertanian Kakao, KBLI 2025** dan menampilkan ruang lingkup produksi benih serta budidaya. Pilihan kode tidak otomatis menggantikan pemilihan ruang lingkup.[10]

Pemeriksaan endpoint publik GISTARU mengembalikan metadata berikut. Ini bukti katalog tersedia, bukan pembuktian seluruh wilayah kabupaten tercakup atau seluruh zona menerima kegiatan.

| Kabupaten | Entri katalog | Batas temuan |
|---|---|---|
| Kab. Kolaka Timur | RDTR Kawasan Perkotaan Tirawuta; RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[6] |
| Kab. Kolaka | RDTR Kawasan Perkotaan Kolaka; RDTR Kawasan Perkotaan Wolo | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[7] |
| Kab. Konawe | RDTR Wilayah Perencanaan Routa; RDTR Pondidaha | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[8] |
| Kab. Konawe Selatan | RDTR Wilayah Perencanaan Laonti; RDTR Wilayah Perencanaan Angata | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[9] |

Daftar kegiatan dari setiap delapan entri telah diambil. Nama kelompok perkebunan aromatik/penyegar muncul dengan ID lokal berbeda; ini kandidat relasi untuk ditinjau, bukan persetujuan langsung KBLI 01273. Pencocokan terhadap industri/perdagangan kakao tidak digunakan sebagai pengganti budidaya.[11][12][13]

| Rencana | Calon kelompok kegiatan yang perlu ditelaah | Sumber |
|---|---|---|
| Kab. Kolaka Timur / RDTR Kawasan Perkotaan Tirawuta | 041 — Perkebunan tanaman aromatik/penyegar | [11] |
| Kab. Kolaka Timur / RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | 041 — Perkebunan tanaman aromatik/penyegar | [12] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Kolaka | 025 — Perkebunan Tanaman Aromatik/Penyegar | [13] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Wolo | 034 — Perkebunan Tanaman Aromatik/Penyegar | [14] |
| Kab. Konawe / RDTR Wilayah Perencanaan Routa | 043 — Perkebunan Tanaman Aromatik/Penyegaran | [15] |
| Kab. Konawe / RDTR Pondidaha | 016 — PERKEBUNAN TANAMAN AROMATIK/PENYEGAR | [16] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Laonti | 044 — Perkebunan Tanaman Aromatik/Penyegar | [17] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Angata | 044 — Perkebunan Tanaman Aromatik/Penyegar | [18] |

Makna status numerik katalog dan keberlakuan masing-masing rencana belum dipastikan. Kemunculan Wolo pada katalog tidak cukup untuk menyebut integrasi/siap pengajuan. Jumlah entri bukan jumlah polygon atau calon lokasi.

## 3. Matriks dependensi

| Lapisan | Status pekerjaan ini | Pekerjaan yang belum selesai |
|---|---|---|
| Katalog KBLI dan ruang lingkup | Halaman 01273 dibaca | Konfirmasi scope budidaya dan pengaturan proyek target |
| Katalog RDTR empat kabupaten | Metadata diambil | Pemeriksaan status, dokumen dan luas cakupan |
| Daftar kegiatan lokal | Diambil untuk delapan entri | Review pemetaan ke budidaya kakao dan aturan per zona |
| Geometri dan ITBX | Belum diuji | Ambil geometri resmi, periksa cakupan, lakukan overlay dan uji kegiatan |
| Jalan | Belum diinventarisasi untuk pilot | Sumber, geometri, kelas jalan dan metode jarak |
| Tutupan/citra | Belum diinventarisasi untuk pilot | Tanggal, resolusi, kategori, ketidakpastian dan hak penggunaan |
| Elevasi/lereng | Belum diinventarisasi | Cakupan, resolusi dan metode evaluasi |
| Tanah, iklim, drainase/genangan | Belum diinventarisasi | Sumber, rubrik agronomi, skala bukti dan batas analisis bidang |
| Polygon kandidat dan peta hasil | Belum dibuat | Menunggu gerbang data/rubrik, bukan diisi lokasi contoh palsu |

## 4. Rancangan penilaian pilot

Pisahkan **kegiatan/zona** dan **indikasi agronomi**. Keduanya memiliki status memenuhi/bersyarat/tidak memenuhi/belum diketahui beserta sumber. Untuk agronomi, inventarisasi variabel medan, iklim, tanah, drainase dan tutupan terlebih dahulu; daftar ini adalah rancangan evaluasi, belum ambang yang disetujui. Dataset beresolusi regional tidak diperlakukan sebagai bukti presisi kondisi bidang 5000m2. Jangan mengeluarkan kelas S1/S2/S3 atau skor peluang izin tanpa metodologi yang tervalidasi.

Ketersediaan/hak tanah tidak menjadi filter wajib rekomendasi. Ketidaktahuan mengenai kriteria wajib seperti aturan lokasi tetap tidak boleh berubah menjadi hasil lulus. Jika sumber tidak cukup, tampilkan keterbatasan atau kandidat eksploratif berlabel belum terverifikasi, bukan kandidat final memenuhi semua kriteria.

## 5. Parameter yang masih terbuka

1. Toleransi luas dan apakah kandidat harus satu polygon utuh.
2. Jumlah kandidat keseluruhan/per kabupaten; tidak memaksakan kuota saat bukti tidak cukup.
3. Jenis jalan, cara ukur dan bobot preferensi; tidak ada ambang maksimum sebagai syarat gugur. Kedekatan geometris berbeda dari akses yang dapat dilalui.
4. Rubrik cocok kakao dan tingkat bukti yang diterima.
5. Bentuk file sudah dikonfirmasi pada tahap berikutnya: SHP ZIP dan KML; skema atribut dan penerimaan target masih terbuka.
6. Perlakuan kondisi bersyarat serta data yang belum tersedia.

## 6. Langkah berikutnya dan batas hasil

Prioritas berikutnya adalah pemeriksaan geometri/ketentuan dan matriks sumber jalan–tutupan–agronomi pada empat kabupaten, lalu menetapkan rubrik serta acceptance criteria. Setelah itu rancang mockup alur pencarian, perbandingan kandidat dan ekspor. Belum ada aplikasi, kandidat koordinat, polygon, uji ITBX per bidang atau uji unggah OSS pada pekerjaan ini.

Literatur agronomi terkait kakao ditemukan melalui indeks pencarian, tetapi pengunduhan langsung dari repositori Kementan gagal pada resolusi DNS. Karena itu pekerjaan ini tidak menetapkan ambang numerik agronomi dari salinan yang belum berhasil dibaca utuh. Bukti kegagalan akses bukan bukti bahwa datanya tidak ada.

### Urutan hasil kerja yang dibutuhkan sebelum development

1. Matriks geometri/ketentuan/cakupan per rencana pada empat kabupaten.
2. Matriks sumber dan kelayakan skala data agronomi, tutupan serta jalan.
3. Rubrik penilaian dan kontrak ekspor yang dapat diuji, dengan jalan hanya preferensi.
4. Mockup peta → kriteria → kandidat → bukti → ekspor, diperiksa Anton.
5. PRD siap bangun, desain teknis/backlog dan persetujuan development.

Daftar ini adalah urutan awal, bukan status pekerjaan terkini. Keputusan jalan tidak mengubah temuan metadata sebelumnya. Lihat [PRD v0.6](../PRD.md), bagian 8.8–8.10, dan [roadmap](../roadmap.md) untuk perkembangan audit/rancangan.

## 7. Bukti kerja

Arsip kerja di luar repositori publik menyimpan `inventory-results.json`, `activities-summary.json`, empat snapshot `rdtr-<id>.json`, delapan snapshot `activities-<id>-<rencana>.json`, `oss-01273-detail.txt` dan `oss-konversi-01270.txt`. Snapshot menyimpan sumber dan waktu pembacaan awal. Commit awal hanya memuat ringkasan serta rujukan publik, bukan snapshot mentah, isi direktori lokal, sesi autentikasi atau kredensial. Temuan ini belum direvalidasi sebagai data live dalam inisialisasi repositori.

## Sources

[6] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7411000000
[7] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7401000000
[8] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7402000000
[9] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7405000000
[10] https://oss.go.id/id/kbli/detail/9f8bd843-df47-5b3d-8794-66a7d1be75b3
[11] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7411000000&id_rtr=001
[12] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7411000000&id_rtr=002
[13] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7401000000&id_rtr=001
[14] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7401000000&id_rtr=002
[15] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7402000000&id_rtr=003
[16] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7402000000&id_rtr=002
[17] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7405000000&id_rtr=002
[18] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7405000000&id_rtr=001
