# Roadmap perencanaan dan gerbang pelaksanaan

**Status:** rencana kerja, bukan komitmen jadwal/biaya atau persetujuan development. Repositori saat ini hanya berisi dokumentasi.

## Ringkasan posisi

| Tahap | Status | Bukti / batas |
|---|---|---|
| Parameter utama pilot | Ditetapkan | Lihat [keputusan](decisions.md); sebagian detail tetap terbuka |
| Katalog KBLI, metadata RDTR dan daftar kegiatan | Pembacaan awal tercatat | [Discovery](discovery/pilot-kakao.md); bukan pengujian seluruh geometri/ketentuan |
| Audit geometri, aturan dan data agronomi | Belum selesai | Belum boleh mengklaim kandidat terverifikasi |
| Rubrik dan kontrak keluaran | Belum disepakati | Ambang, toleransi, jumlah kandidat dan format perlu ditetapkan |
| Mockup | Belum dibuat/disetujui | Tidak ada aplikasi atau hasil lokasi nyata |
| Desain teknis/backlog/estimasi | Belum difinalisasi | Stack di PRD masih usulan |
| Development/integrasi OSS | Belum dimulai | Memerlukan persetujuan terpisah |

## Tahap A — Audit data inti pilot

Cakupan: Kolaka Timur, Kolaka, Konawe dan Konawe Selatan, kegiatan sumber `01273`, target `5000m2`.

- [ ] Periksa geometri, CRS, cakupan dan metadata rencana yang ditemukan.
- [ ] Periksa status/keberlakuan rencana serta sumber ketentuan kegiatan.
- [ ] Telaah pemetaan budidaya kakao ke kegiatan lokal; jangan mengganti dengan industri/perdagangan kakao.
- [ ] Bedakan daftar filter dengan ketentuan izin/terbatas/bersyarat per zona.
- [ ] Inventarisasi sumber medan, tanah, iklim, drainase/genangan dan tutupan.
- [ ] Inventarisasi jaringan jalan untuk preferensi pemeringkatan, bukan syarat gugur.
- [ ] Catat akses, hak penggunaan, sumber, tanggal, resolusi, cakupan, unknown dan alternatif.

**Keluaran:** matriks sumber dan cakupan per wilayah/rencana; bukti yang bisa ditelusuri; daftar keterbatasan.

**Gerbang:** dapat dijelaskan bagian yang dapat dinilai dan yang belum. Jika data tidak memadai, ubah klaim/cakupan secara terbuka; jangan mengisi kandidat fiktif atau memaksa kuota per kabupaten.

## Tahap B — Rubrik dan kontrak keluaran

- [ ] Konfirmasi ruang lingkup pilot.
- [ ] Tetapkan aturan kegiatan/zona dan indikasi agronomi sebagai dimensi terpisah.
- [ ] Tentukan kriteria wajib, preferensi dan penanganan bukti yang hilang.
- [ ] Tentukan toleransi luas, polygon utuh/multipart, jumlah kandidat dan metode evaluasi.
- [ ] Tinjau metode/kelas jalan dan bobot; pertahankan jalan sebagai preferensi saja.
- [ ] Sepakati skema ekspor serta label polygon rencana.
- [ ] Susun kasus penerimaan positif/negatif dengan label pembanding.

**Gerbang:** rubrik dan contoh penilaiannya dapat diperiksa; tidak mengklaim kesesuaian tingkat bidang hanya dari data regional. Tidak ada skor peluang izin yang dibuat-buat.

## Tahap C — Mockup dan validasi alur

Layar yang direncanakan: peta/filter → kriteria → perbandingan kandidat → detail bukti/unknown → pilihan kandidat → ekspor rencana.

- [ ] Rancang mockup berlabel ilustrasi jika belum memakai hasil nyata.
- [ ] Tampilkan cakupan data dan status bersyarat/unknown, bukan hanya warna hijau.
- [ ] Pisahkan pilihan rencana dari kesiapan pengajuan resmi.
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
