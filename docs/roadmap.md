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
| Prototipe eksplorasi | Dibuat dan diuji; review pengguna belum | [Alur dan uji](design/mockup.md); hanya KBLI/wilayah, tanpa kandidat atau ekspor GIS |
| Sorotan geometri pilot historis | Terintegrasi dan teruji pada satu RDTR Tirawuta pada 25 Oktober 2026 | [20 polygon sumber dan 18 pemeriksaan browser](design/zone-overlay.md); relevan untuk ditelaah, bukan izin/exact-KBLI terverifikasi |
| Filter seluruh kabupaten/kota | 17 pilihan tersedia; 32 pemeriksaan browser lulus | [Kontrak filter](design/region-filter.md); sumber ID GISTARU baru 11, enam kunci internal eksplisit; bukan perluasan geometri |
| Eksplorasi lintas-rencana | 5.994 polygon dari 16 rencana; 98 pemeriksaan browser setelah perbaikan review lulus | [Kontrak API/klien](design/province-api.md), [bukti browser](design/province-verification.json), [review kode](design/province-review.json); 2 relasi unknown/6 wilayah tidak tercantum, bukan izin |
| Baseline performa dan sorotan adaptif | Baseline SVG tiga run dan checkpoint styling diukur; 98 pemeriksaan browser styling lulus | [Angka baseline](design/map-performance-baseline.json). Replay privat diberi label; styling saja tetap mengirim 104.586.993 byte geometri per run, bukan perbaikan payload |
| Geometri tampilan/detail/viewport | Uji terkendali selesai; pemuatan live masih perlu perbaikan | QA 27 Oktober: 55 Python, 56 Node, 139 pemeriksaan SVG dan 139 Canvas, 6 benchmark. SVG tetap default; bukti rinci privat. Keberhasilan snapshot tidak menutup masalah busy/pergantian snapshot pada jalur live; D-15 mengarahkan rancangan sumber lokal |
| Database RDTR mandiri | 16 rencana aktif lokal, satu KBLI 01273/2025 | Migrasi001–004 utuh; 5.994 fitur valid/15 karantina/17.982 LOD. Dua rilis disimpan, satu pointer aktif. 203 Python/111 Node/38 pemeriksaan native lulus, dua review independen tanpa blocker. Backup sebelum/sesudah aktivasi, restore nyata dan drill rollback terisolasi lulus. [Checkpoint terkini](design/exploration-01273-checkpoint.md), [kontrak baca](design/rdtr-local-read-contract.md). Bukan produksi, full RDTR atau izin |
| Navigasi sorotan langsung dan cleanup | Diuji ulang pada 16 rencana aktif | Apply langsung fokus, lingkaran emas klik/sentuh/keyboard; pusat mobile tidak tertutup polygon viewport. Overview batch/reuse terpin mempertahankan proof segar, tanpa fallback legacy/TTL bypass. Pengukuran ready lokal 15,3 → 4,5 detik bersifat observasional, bukan SLA. [Checkpoint terkini](design/exploration-01273-checkpoint.md); [publikasi kode sebelumnya](design/local-release-checkpoint.md) tetap historis |
| Panel admin/sinkronisasi RDTR | Ditunda atas arahan Anton | Dibuat setelah jalur baca lokal stabil; tidak membangun scheduler/panel pada tahap rancangan sekarang |
| Desain teknis/backlog/estimasi | Belum difinalisasi | Stack di PRD masih usulan |
| Mesin produksi/integrasi OSS | Belum dimulai | Prototipe eksplorasi bukan persetujuan seluruh cakupan atau tindakan OSS |

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

Alur produk yang dituju tetap peta/filter → kriteria → perbandingan kandidat → detail bukti/unknown → pilihan kandidat → ekspor rencana. Implementasi tahap ini hanya **eksplorasi KBLI/wilayah dan detail zona**; luas/jalan/kandidat berada pada modul lain.

- [x] Buat mockup interaktif berlabel perencanaan tanpa kandidat/polygon rekaan.
- [x] Tampilkan batas cakupan, bukti turunan dan unknown; tidak menggambar zona sesuai tanpa evaluasi.
- [x] Pisahkan konfigurasi/rencana dari kesiapan pengajuan resmi; ekspor GIS nonaktif.
- [x] Hubungkan API terbatas Tirawuta ke sorotan biru, legenda dan detail polygon sumber; 20 fitur nyata teruji.
- [x] Uji perubahan filter, respons rusak/terlambat, cache, keyboard/seluler dan unduhan JSON; 18 pemeriksaan browser lulus.
- [ ] Review relasi exact-KBLI serta ketentuan Tirawuta sebelum menerbitkan status kesesuaian terverifikasi.
- [x] Perluas kontrak API/klien ke seluruh 18 rencana pada snapshot, 16 calon kegiatan dengan 6 gap wilayah/2 unknown; validasi dan batas bukti dipertahankan. Uji sumber nyata lulus 98 pemeriksaan; [review independen ulang](design/province-review.json) lulus tanpa temuan pemblokir.
- [ ] Tinjau alur bersama pemilik kebutuhan.

### Optimasi eksplorasi yang diminta

- [x] Ukur baseline nyata sebelum mengubah produksi; tiga browser terisolasi pada dataset/viewport sama, byte HTTP bukan ukuran cache.
- [x] Uji styling adaptif zoom/seleksi terhadap checkpoint sumber utuh: 16 unit dan 98 pemeriksaan browser lulus, termasuk seluruh daftar keyboard dan sentuhan seluler.
- [x] Integrasikan level tampilan/detail terikat snapshot dan uji terkendali; sumber asli serta batas umur adapter live tetap dipertahankan.
- [x] Bandingkan SVG/Canvas pada data/skema uji yang sama; SVG tetap default berdasarkan hasil yang tersedia.
- [x] Jalankan uji area/zoom, revisi terlambat dan hitungan terpisah pada replay; masalah reload-required pada pengamatan live dicatat terpisah dan tidak dinyatakan selesai.
- [x] Review independen kode dan susun laporan QA privat; tidak menyamakan hasil tersebut dengan kelulusan produksi/live.
- [x] Izin publikasi kode/commit/push dikonfirmasi Anton pada 29 Oktober 2026 melalui D-18/DEC-19; hanya kode, skema, tes dan dokumentasi terverifikasi. Publikasi dataset/deployment produksi tetap terpisah. Vector tiles bukan migrasi otomatis.

**Gerbang:** alur disetujui tanpa menyamakan mockup dengan bukti kelayakan lokasi.

## Tahap D — PRD siap bangun dan desain teknis

### Irisan D-15/D-16 — rancangan, fondasi lokal, lalu jalur baca database

- [x] Catat arah penyimpanan sendiri dan tunda panel admin/sinkronisasi.
- [x] Susun model/ERD, identitas lokal, arsip sumber, karantina, impor awal, rilis dan kontrak API baca.
- [x] Anton mengizinkan implementasi lokal dan impor awal bertahap setelah tahap desain; bukan izin deployment/redistribusi produksi.
- [x] Buat skema/validator dan impor awal terukur: Tirawuta 20 dan Routa 1.688 fitur; subset `01273` tidak disebut full-layer.
- [x] Tutup temuan review fondasi, jalankan regresi/review ulang dan migrasi002/003 tanpa mengubah histori atau mereset data. Ini bukan kelulusan kode API baru yang masih dibangun.
- [ ] Tetapkan hak data, deployment/backup/retensi dan kebijakan umur untuk penggunaan produksi; belum ditetapkan hanya karena runtime lokal aktif.
- [x] Uji jalur baca rilis lokal dua rencana, pin versi dan kegagalan/rollback; browser nyata serta lima endpoint HTTP telah diuji. Performa seluruh 16 rencana dan rollout berikutnya belum disahkan.
- [ ] Rancang/bangun panel admin dan sinkronisasi pada fase berikutnya, bukan sebagai prasyarat desain sekarang.

Model target berada di [rancangan database RDTR](design/rdtr-database.md), kontrak SQL di [kontrak skema](design/rdtr-db-schema-contract.md), dan bukti/batas implementasi di [checkpoint fondasi](design/rdtr-db-foundation.md). Empat migrasi, impor 16 versi dan rilis lokal dua rencana sudah diverifikasi; 14 versi lain masih staging. Adapter live/TTL tidak diganti atau dinyatakan selesai; perluasan LOD/rilis memerlukan gerbang berikutnya.

- [ ] Putuskan cakupan rilis dan pengecualian sambil mempertahankan visi ujung ke ujung.
- [ ] Tetapkan peran/akses, kebijakan data/AI/cloud, persetujuan dan pemulihan kegagalan.
- [ ] Susun desain teknis, backlog, dependensi dan matriks uji.
- [ ] Estimasikan durasi/biaya berdasarkan scope serta risiko yang sudah diperiksa.
- [ ] Finalisasi persetujuan cakupan pembangunan mesin produksi; kelanjutan prototipe eksplorasi sudah diminta pengguna, bukan izin pengajuan OSS.

**Gerbang:** Definition of Ready pada [PRD](PRD.md) terpenuhi. Persetujuan commit dokumentasi tidak dihitung sebagai persetujuan tahap ini.

## Tahap E — Development, hanya setelah disetujui

Urutan implementasi berikut masih usulan: alur data/perusahaan → KBLI → peta/rekomendasi pilot → generator/ekspor polygon → paket siap input → bantuan OSS sesuai kelayakan dan otorisasi.

Uji kandidat nyata, pembentukan GIS dan unggah target harus menghasilkan bukti eksekusi tersendiri. Jangan menyebut selesai hanya karena antarmuka tampil atau file valid secara lokal. Integrasi yang tidak tersedia/diizinkan memerlukan fallback dan perubahan scope yang disetujui.

## Aturan lintas tahap

- Audit data dan rancangan rubrik boleh berjalan berdampingan; mockup tidak harus menunggu semua wilayah lengkap.
- Tidak ada dokumen klien, rahasia, sesi browser/OSS, snapshot mentah atau ekspor proyek yang otomatis masuk repo publik.
- Temuan baru memperbarui discovery, keputusan dan PRD; status lama tidak ditimpa seolah telah diverifikasi ulang.
- Belum ada tanggal peluncuran, batas biaya atau target performa yang disepakati.
