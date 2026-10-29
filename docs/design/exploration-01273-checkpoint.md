# Checkpoint lokal — eksplorasi satu KBLI 01273/2025

**Tanggal:** 29 Oktober 2026. **Status:** rilis lokal 16 rencana sudah aktif dan dibaca kembali melalui akun reader; bukan deployment produksi atau keputusan izin. Tidak menambah KBLI.

## Keadaan yang diverifikasi

| Komponen | Hasil |
|---|---|
| Versi rencana aktif | 16 |
| Fitur asli valid dalam inventaris | 5.994 |
| Karantina | 15 dari 6.009 matched; tanpa repair |
| LOD tiga tingkat | 17.982 baris |
| Rilis tersimpan / pointer aktif | 2 / 1; rilis dua rencana sebelumnya dipertahankan |
| Pilihan wilayah administratif | 17; hanya sumber yang tersedia yang dapat digambar |
| Relasi katalog belum tersedia | 2 rencana; bukan hasil nol atau bukti larangan |
| Wilayah tidak tercantum di snapshot | 6; bukan bukti tidak ada RDTR |

Data tetap subset filter kegiatan, pengamatan sumber 26 Oktober 2026, bukan seluruh zona/ketentuan Sulawesi Tenggara atau data live terbaru. Inventaris lengkap berbeda dari subset yang tergambar sesuai viewport.

## Hasil tahap 1–5

1. **Data:** tiga LOD untuk 14 versi tambahan selesai, 16 anggota kandidat disegel. Geometri/atribut/waktu sumber direkonsiliasi; tidak mengimpor ulang atau mengulang audit jaringan provinsi.
2. **Performa dan rilis:** grouped proof seluruh anggota tetap segar tiap request; overview batch diumumkan melalui kapabilitas ketat. Reuse inventaris hanya pada overview lokal yang bounds sumber aslinya sepenuhnya tercakup viewport. Pin/provenance tidak diganti, tidak ada fallback terselubung dan timeout SQL tetap tiga detik. Review independen backend/operasi dan frontend lulus tanpa blocker; aktivasi kandidat yang sudah tersimpan memakai transaksi compare-and-swap setelah proof, bukan membuat rilis baru. Pembacaan baru memastikan 20 tabel selain pointer tetap identik.
3. **Cakupan:** 17 badge membedakan aktif, tersimpan belum aktif, belum tersedia dan unknown. Perubahan viewport tidak membangun ulang inventaris. Lingkaran navigasi berada di pane di atas polygon agar pusatnya tetap dapat disentuh setelah respons viewport.
4. **Bukti:** klasifikasi 01273/2025 dan entri pada lampiran perubahan BPS 6/2026 diverifikasi dari dokumen resmi. Jejak 18 rencana dan 32 sampel historis dicatat dalam [review bukti](../discovery/kbli-01273-review.md). **Review exact-KBLI/kegiatan lokal, matriks ITBX seluruh bidang dan penerimaan proyek OSS belum selesai**; engineering/evidence pack yang tersedia bukan persetujuan domain.
5. **Operasional:** backup privat sebelum dan sesudah aktivasi telah dibuat, checksum/manifest diverifikasi, keduanya dipulihkan ke database terisolasi yang dipertahankan. Reader pada restore terbaru melihat 16 rencana dengan pin aktif yang sama. Drill committed 16 → rollback 2 dilakukan di restore terisolasi; snapshot 21 tabel dikembalikan identik. Probe katalog/overview/detail server lokal mengembalikan HTTP 200; status, ukuran, umur backup dan WAL dapat diperiksa. [Panduan operasi](rdtr-operations.md).

## Verifikasi dan pengukuran

- **203 Python, 111 Node, 38 pemeriksaan browser native lulus** setelah aktivasi dan pemuatan ulang backend lokal. Browser memverifikasi 5.994 ID sumber, desktop/mobile, pusat lingkaran tidak tertutup, Apply setelah pan, pergantian viewport, detail, consent dan pin rilis.
- Pada pengamatan lokal, ready dari opt-in tercatat 15.317 ms sebelum batching dan 4.521 ms pada run aktif terakhir. Keduanya menggunakan readiness oracle yang sama; ini pengamatan satu lingkungan, bukan uji kausal terkontrol, SLA produksi atau jaminan perangkat lain.
- Heap/DOM/task metrics berasal dari CDP pada sembilan titik skenario; metrik yang tidak didukung tetap null. Long tasks masih teramati. Sampel ini bukan pengukuran peak memory atau bukti bebas memory leak.
- Bukti, log, snapshot/hash, screenshot, backup, database dan konfigurasi tetap privat di luar cakupan publikasi kode. Anton telah mengizinkan commit/push checkpoint kode ini secara terpisah; izin tersebut bukan publikasi data atau deployment.

## Batas yang tetap terbuka

- Pemetaan exact-KBLI, ruang lingkup budidaya versus benih, aturan lengkap/blok dan ITBX, hak redistribusi produksi serta penerimaan OSS.
- UAT oleh Anton, produksi/offsite/PITR, panel admin, sinkronisasi dan pengajuan OSS. WAL archive/PITR dan scheduler tidak diaktifkan.
- Keandalan jalur legacy/live port 8765; kelulusan lokal bukan perbaikan jalur tersebut.

Jalankan melalui [README](../../README.md). Server lokal yang diuji ada di port **8769**. Clone repo tidak menyertakan dataset dan tidak mengaktifkan rilis secara otomatis. [Checkpoint publikasi sebelumnya](local-release-checkpoint.md) tetap merupakan catatan historis rilis dua rencana.
