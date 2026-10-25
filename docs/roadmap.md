# Roadmap perencanaan dan gerbang pelaksanaan

**Status:** pengguna mengizinkan tahapan proyek dilanjutkan. Audit teknis terbatas selesai; rancangan dan review berikutnya berjalan tanpa menganggap seluruh parameter telah disetujui. Belum ada komitmen jadwal/biaya atau izin pengajuan OSS.

## Ringkasan posisi

| Tahap | Status | Bukti / batas |
|---|---|---|
| Parameter utama pilot | Ditetapkan | Lihat [keputusan](decisions.md); sebagian detail tetap terbuka |
| Katalog KBLI, metadata RDTR dan daftar kegiatan | Pembacaan awal tercatat | [Discovery](discovery/pilot-kakao.md); bukan pengujian seluruh geometri/ketentuan |
| Audit geometri dan sampel ITBX | Selesai terbatas pada delapan layer dan 35 titik | [Laporan audit](discovery/rdtr-geometry-audit.md); bukan pengujian seluruh bidang/exact-KBLI |
| Pembacaan aturan lengkap dan data agronomi | Belum selesai | Belum boleh mengklaim kandidat terverifikasi |
| Inventaris sumber agronomi/jalan dan uji akses | Selesai terbatas; analisis cakupan penuh belum | [Matriks sumber](discovery/data-sources.md); sampel/akses parsial bukan kesesuaian bidang |
| Rubrik dan kontrak keluaran | Draf tersedia, belum disepakati | [Rubrik usulan](design/scoring-rubric.md); format SHP ZIP + KML sudah dipilih, skema/ambang/toleransi masih terbuka |
| Mockup | Dibuat dan diuji; review pengguna belum | [Alur dan uji](design/mockup.md); tanpa kandidat nyata atau ekspor GIS |
| Desain teknis/backlog/estimasi | Belum difinalisasi | Stack di PRD masih usulan |
| Development/integrasi OSS | Belum dimulai | Memerlukan persetujuan terpisah |

## Tahap A — Audit data inti pilot

Cakupan: Kolaka Timur, Kolaka, Konawe dan Konawe Selatan, kegiatan sumber `01273`, target `5000m2`.

- [x] Periksa geometri, CRS, rekonsiliasi ID dan metadata delapan layer yang ditemukan; tidak menyamakan cakupan layer dengan seluruh kabupaten.
- [ ] Periksa status/keberlakuan rencana serta sumber ketentuan kegiatan.
- [ ] Telaah pemetaan budidaya kakao ke kegiatan lokal; jangan mengganti dengan industri/perdagangan kakao.
- [x] Buktikan melalui 35 sampel bahwa daftar filter memuat kategori berbeda; pemeriksaan setiap bidang/blok tetap belum selesai.
- [x] Inventarisasi sumber medan, tanah, iklim, drainase/genangan dan tutupan; uji akses terbatas dicatat, bukan analisis seluruh wilayah.
- [x] Inventarisasi sumber jaringan jalan untuk preferensi; kelengkapan jaringan pilot belum diaudit.
- [x] Catat akses, ketentuan penggunaan yang terbaca, sumber, tanggal, resolusi, unknown dan alternatif; pemeriksaan lisensi produksi tetap terbuka.
- [ ] Selesaikan OCR/review referensi Kementan dan analisis cakupan/NoData masing-masing kabupaten sebelum menilai bidang.

**Keluaran:** matriks sumber dan cakupan per wilayah/rencana; bukti yang bisa ditelusuri; daftar keterbatasan.

**Gerbang:** dapat dijelaskan bagian yang dapat dinilai dan yang belum. Jika data tidak memadai, ubah klaim/cakupan secara terbuka; jangan mengisi kandidat fiktif atau memaksa kuota per kabupaten.

## Tahap B — Rubrik dan kontrak keluaran

- [ ] Konfirmasi ruang lingkup pilot.
- [ ] Tetapkan aturan kegiatan/zona dan indikasi agronomi sebagai dimensi terpisah.
- [ ] Tentukan kriteria wajib, preferensi dan penanganan bukti yang hilang.
- [ ] Tentukan toleransi luas, polygon utuh/multipart, jumlah kandidat dan metode evaluasi.
- [ ] Tinjau metode/kelas jalan dan bobot; pertahankan jalan sebagai preferensi saja.
- [x] Konfirmasi pilihan format SHP ZIP dan KML.
- [ ] Sepakati skema atribut, label polygon rencana dan uji kontrak ekspor/unggah.
- [ ] Susun kasus penerimaan positif/negatif dengan label pembanding.

Draf rubrik dan skenario penerimaan sudah tersedia pada [rancangan rubrik](design/scoring-rubric.md); checkbox di atas menyatakan keputusan/validasi akhir, bukan ketiadaan draf. Aturan belum diaktifkan hanya karena angka referensi berhasil dibaca.

**Gerbang:** rubrik dan contoh penilaiannya dapat diperiksa; tidak mengklaim kesesuaian tingkat bidang hanya dari data regional. Tidak ada skor peluang izin yang dibuat-buat.

## Tahap C — Mockup dan validasi alur

Layar yang direncanakan: peta/filter → kriteria → perbandingan kandidat → detail bukti/unknown → pilihan kandidat → ekspor rencana.

- [x] Buat mockup interaktif berlabel perencanaan tanpa kandidat/polygon rekaan.
- [x] Tampilkan batas cakupan, bukti turunan dan unknown; tidak menggambar zona sesuai tanpa evaluasi.
- [x] Pisahkan konfigurasi/rencana dari kesiapan pengajuan resmi; ekspor GIS nonaktif.
- [ ] Tinjau alur bersama pemilik kebutuhan.

**Gerbang:** alur disetujui tanpa menyamakan mockup dengan bukti kelayakan lokasi.

## Tahap D — PRD siap bangun dan desain teknis

- [ ] Putuskan cakupan rilis dan pengecualian sambil mempertahankan visi ujung ke ujung.
- [ ] Tetapkan peran/akses, kebijakan data/AI/cloud, persetujuan dan pemulihan kegagalan.
- [ ] Susun desain teknis, backlog, dependensi dan matriks uji.
- [ ] Estimasikan durasi/biaya berdasarkan scope serta risiko yang sudah diperiksa.
- [ ] Peroleh persetujuan development eksplisit.

**Gerbang:** Definition of Ready pada [PRD](PRD.md) terpenuhi. Persetujuan commit dokumentasi tidak dihitung sebagai persetujuan tahap ini.

## Tahap E — Development, hanya setelah disetujui

Urutan implementasi berikut masih usulan: alur data/perusahaan → KBLI → peta/rekomendasi pilot → generator/ekspor polygon → paket siap input → bantuan OSS sesuai kelayakan dan otorisasi.

Uji kandidat nyata, pembentukan GIS dan unggah target harus menghasilkan bukti eksekusi tersendiri. Jangan menyebut selesai hanya karena antarmuka tampil atau file valid secara lokal. Integrasi yang tidak tersedia/diizinkan memerlukan fallback dan perubahan scope yang disetujui.

## Aturan lintas tahap

- Audit data dan rancangan rubrik boleh berjalan berdampingan; mockup tidak harus menunggu semua wilayah lengkap.
- Tidak ada dokumen klien, rahasia, sesi browser/OSS, snapshot mentah atau ekspor proyek yang otomatis masuk repo publik.
- Temuan baru memperbarui discovery, keputusan dan PRD; status lama tidak ditimpa seolah telah diverifikasi ulang.
- Belum ada tanggal peluncuran, batas biaya atau target performa yang disepakati.
