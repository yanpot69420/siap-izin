# Checkpoint kode — database lokal dan navigasi sorotan

**Tanggal:** 29 Oktober 2026. **Lingkup publikasi:** kode aplikasi, skema/migrasi, tes dan dokumentasi. Bukan publikasi dataset atau deployment produksi.

## Implementasi yang tersedia

- Penyimpanan PostgreSQL/PostGIS terpisah untuk sumber asli, provenance, versi, karantina, LOD dan rilis terpin. Empat migrasi additive yang sudah diterapkan tidak ditulis ulang.
- API GET-only loopback memakai login reader terpisah dan transaksi baca-saja; tidak menggunakan owner atau ATR/BPN sebagai fallback.
- Inventaris lengkap dipisahkan dari polygon yang tergambar pada viewport. Overview, area dan detail terikat versi/rilis; unknown atau belum tersedia bukan hasil nol yang berhasil.
- Setelah opt-in peta publik, Terapkan langsung memusatkan sorotan tanpa wajib membuka daftar sumber. Lingkaran emas hanya indeks navigasi per wilayah dengan inventaris valid; klik, sentuh, Enter atau Space memperbesar area sumber yang tersedia. Bukan batas kabupaten, kandidat lokasi atau bukti izin.
- Penanda memakai metadata bounds, tidak menelusuri seluruh koordinat dan tidak menambah library/minimap/endpoint. Tidak ada animasi berulang; lingkaran disembunyikan pada zoom dekat agar polygon dapat diklik.
- Cleanup mempertahankan validasi/provenance, membatasi antrean/abort, menghindari rebuild inventaris pada perubahan viewport saja, serta mengurangi hashing/transfer biner yang redundan tanpa cache lintas-request.

## Keadaan data lokal — tidak disertakan dalam repository

| Komponen | Jumlah / status |
|---|---|
| Versi rencana tersimpan | 16 |
| Fitur asli valid | 5.994 |
| Karantina | 15 dari 6.009 matched, tanpa repair |
| Rilis aktif | 1, berisi Routa 1.688 dan Tirawuta 20 fitur |
| LOD tersimpan | 5.124 baris untuk tiga tingkat pada dua rencana |
| Tambahan staging | 14 versi / 4.286 fitur valid, belum LOD atau rilis aktif |

Ini subset filter kegiatan terkait KBLI 01273 dari pengamatan arsip 26 Oktober 2026. Waktu impor tidak memperbarui tanggal sumber. Pemetaan exact-KBLI tetap belum direview, izin unknown; bukan seluruh zona/ketentuan RDTR Sulawesi Tenggara atau data live terkini.

## Gerbang verifikasi

- Fresh regression: **177 Python, 96 Node**, seluruhnya lulus tanpa skipped.
- Browser nyata pada server SQL lokal setelah perubahan terakhir dan pemuatan ulang kode server: **28 pemeriksaan lulus**, termasuk kesetaraan 1.708 ID sumber, Apply setelah pan jauh, klik lingkaran Routa, sentuh lingkaran Tirawuta, klik polygon/detail dan cakupan parsial.
- Review independen fondasi/backend dan penutupan frontend lulus pada scope masing-masing. Review frontend terakhir menjalankan 36 probe; mutation probes membuktikan dua regresi dapat terdeteksi. Temuan output-path sebelum mkdir dan proof revisi Apply telah ditutup; ini bukan sertifikasi keamanan produksi.
- Lima endpoint HTTP masing-masing diukur lima kali dalam kondisi hangat: body byte/SHA-256 identik dengan baseline; jumlah data dan pin aktif tidak berubah. Median lokal turun 14,75–22,40%, bukan pembuktian kausal lintas-lingkungan atau budget 16 rencana.
- Snapshot/hash dan keluaran lengkap pengujian disimpan privat di luar repo. Tidak menyertakan screenshot, respons mentah atau geometri untuk mereproduksi angka tersebut secara mandiri dari clone publik.

## Yang tetap terpisah

1. LOD, candidate release, pengujian/review dan aktivasi 14 versi staging.
2. Keandalan adapter legacy/live; keberhasilan jalur lokal tidak menutup masalah jalur lama.
3. Matriks ITBX lengkap, review exact-KBLI, hak redistribusi/cache produksi dan evaluasi seluruh bidang.
4. Deployment, retensi/WAL/backup produksi, panel admin, sinkronisasi otomatis dan pengajuan OSS.

Instruksi menjalankan kedua jalur ada pada [README](../../README.md); prasyarat dan sejarah checkpoint ada di [fondasi database](rdtr-db-foundation.md), [kontrak baca](rdtr-local-read-contract.md) dan [navigasi](map-region-navigation.md). Database, konfigurasi rahasia dan sumber privat harus disiapkan operator secara sah; clone kode tidak mengimpor atau mengaktifkan data secara otomatis.
