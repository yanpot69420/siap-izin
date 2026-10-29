# Penyempurnaan eksplorasi — satu KBLI 01273

Status: pelaksanaan diizinkan Anton pada 29 Oktober 2026. Cakupan hanya KBLI `01273`, versi `2025`; tidak menambah pilihan KBLI, kandidat lahan atau pengajuan OSS.

## Baseline dan batas perubahan

Baseline kode `2c523e7`: database 16 versi/5.994 fitur valid/15 karantina; rilis aktif hanya Routa–Tirawuta dengan 1.708 fitur dan 5.124 LOD. Persiapan tambahan tidak boleh mengganti pointer aktif. Empat migrasi yang sudah diterapkan tidak ditulis ulang. Sumber arsip tetap pengamatan 26 Oktober, filtered_subset/filter_membership_only, mapping unreviewed dan permission unknown.

## Tahap dan kriteria selesai

1. **Data:** rekonsiliasi dan persiapkan tiga LOD untuk 14 versi staging, checkpoint per versi, cocokkan kembali hash geometri/atribut/waktu sumber serta karantina. Susun kandidat 16 rencana tanpa aktivasi; seluruh 5.994 ID valid tetap ada. Tidak mengimpor ulang atau menjalankan audit provinsi jaringan yang pernah diblokir.
2. **Performa dan rilis:** ukur katalog, overview, viewport dan detail dengan kandidat nyata, budget SQL tetap tiga detik per statement. Uji browser desktop/mobile, pan/zoom, revisi/abort/partial, jumlah inventaris versus gambar, penggunaan memori dan payload. Target latensi/SLA produksi belum ditetapkan; laporkan pengukuran lokal dan biaya validasi, jangan menaikkan timeout untuk menyembunyikan kegagalan. Review independen dan bukti rollback diperlukan sebelum pointer exploration diganti.
3. **Cakupan:** bedakan data aktif, tersimpan belum aktif, belum tersimpan, katalog tidak mencantumkan wilayah, serta kegagalan muat. Metadata penyimpanan adalah keadaan katalog saat dibaca, bukan tanggal pengamatan sumber atau bukti immutable rilis. Penanda peta hanya sumber valid yang benar-benar dimuat; pembaruan viewport tidak membangun ulang seluruh panel/pilihan.
4. **Bukti satu KBLI:** verifikasi klasifikasi resmi 01273/2025 dan ketentuan perubahan yang relevan. Telusuri kegiatan lokal, field/value filter dan ketentuan yang benar-benar tersedia. Pisahkan klasifikasi, keanggotaan filter, review exact-KBLI, ITBX seluruh bidang dan penerimaan proyek OSS. Bukti tidak cukup tetap unknown dan dicatat sebagai penghambat validasi domain, bukan dibuat seolah selesai.
5. **Operasional:** alat backup privat SQL + blob, checksum/manifest konsisten, uji restore ke database terisolasi baru dan bandingkan isi/pointer. Uji pengembalian rilis, status kesehatan/ukuran/cadangan dan dokumentasi retensi/WAL. Tidak menghapus backup/riwayat, menjadwalkan sinkronisasi, membangun panel admin, atau deploy produksi secara otomatis.

## Kontrak tambahan status penyimpanan

Katalog lokal boleh menambahkan `plan.localStorage = {state: 'stored' | 'not_stored'}`. Field ini terpisah dari `localDataset` terpin, divalidasi ketat, opsional untuk kompatibilitas fixture/legacy; tidak ada field berarti unknown. Jika dataset aktif, status harus stored. Tersimpan mengacu versi/mapping 01273/2025/scope yang cocok dengan identitas sumber. Tidak mengubah jumlah sumber tersedia menjadi nol bila tidak diketahui. Tidak menyalin objek penyimpanan mentah ke ekspor provenance.

## Verifikasi dan otorisasi

Tes sintetis SQL hanya pada `siap_izin_test`, lifetime fixture memakai advisory lock bersama. Parent memegang operasi development nyata; restore hanya ke target baru yang dijaga, bukan drop/reset development. Data/config/blob/evidence/backup tetap privat, direktori 0700 dan berkas 0600. Aktivasi setelah seluruh gerbang lulus adalah operasi lokal, bukan publikasi dataset. Perubahan baru belum otomatis commit/push karena publikasi sebelumnya merupakan checkpoint terpisah.
