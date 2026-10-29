# Operasi lokal RDTR: backup privat dan drill restore

## Batas otorisasi

CLI standar-library Python 3 ini tidak membaca konfigurasi privat/DSN, tidak mengambil data upstream, tidak mengubah panel/API, dan tidak men-deploy apa pun. Container dikunci ke `siap-izin-rdtr-db`, role `siap_izin_owner`. Sumber hanya `siap_izin_dev` atau `siap_izin_test`. Koneksi memakai local socket/trust di dalam container, **tanpa password pada argv/env**. Tidak ada stop/restart server, DROP database, reset, `--clean`, ataupun scheduler.

`status` dan sumber backup memakai satu transaksi `REPEATABLE READ READ ONLY`. Backup mempertahankan transaksi pengekspor snapshot sampai dump, inventaris, dan salinan blob selesai. `pg_dump --format=custom --snapshot=…` mengekspor seluruh database; manifest menghitung seluruh tabel `rdtr` dalam snapshot yang sama, SHA-256 isi baris kanonik terurut, bukti SHA-256 source EWKB, active-release pin, dan daftar semua referensi `source_artifact`. Semua blob referensi dicocokkan nama `<sha256>.json`, panjang, dan SHA-256; blob hilang/berubah membuat backup gagal tertutup. Blob tidak direkonstruksi dari SQL. Blob tanpa referensi tidak disalin. Kebijakan penyimpanan sumber harus immutable/content-addressed; jangan hapus blob selama backup.

## Prasyarat operator

- Docker Desktop aktif; container di atas berjalan dengan PostgreSQL 17/PostGIS dan utilitas `psql`, `pg_dump`, `createdb`, `pg_restore` di dalamnya. Host tidak membutuhkan utilitas PostgreSQL atau psycopg.
- Role memiliki akses baca penuh untuk dump sumber dan `CREATEDB` untuk drill. Role pemilik/reader lain yang direferensikan ownership/ACL dump harus sudah ada pada cluster yang sama. Tidak ada fallback `--no-owner`/`--no-acl`; dependency/permission hilang adalah kegagalan, bukan alasan menghapus ACL. Extension yang dibutuhkan harus tersedia dan role harus berwenang membuatnya.
- Path output/bundle absolut dan di luar checkout repo aktual; tidak ada `..`, symlink (termasuk ancestor/dangling), ancestor writable oleh group/other, atau file hardlink. Parent output **sudah ada**, milik operator dan mode `0700`. CLI tidak membuat ancestor secara rekursif. Root input blob boleh berada di direktori privat yang diabaikan Git dalam checkout; pengecualian ini hanya untuk pembacaan input, bukan keluaran backup. Root blob juga milik operator dan `0700`; file `0600`, regular, link-count 1. Gunakan path fisik, bukan alias symlink `/tmp` atau `/var`.
- macOS atau Linux dengan exclusive atomic directory rename. Output yang sudah ada tidak pernah diganti/dihapus, bahkan direktori kosong. Staging privat `.rdtr-pending-*` yang gagal sengaja dibiarkan agar tidak menghapus path yang salah; tidak dianggap backup valid.
- Backup dipercaya berasal dari operator. Checksum manifest/dump/blob mendeteksi kerusakan/perubahan tanpa pembaruan checksum, **bukan tanda tangan/authentication**. Penyerang yang dapat menulis ulang bundle dan checksum tidak dicegah. `pg_restore` atas archive tidak tepercaya dapat menjalankan SQL; jangan restore bundle asing.

## Perintah untuk parent/operator

Dari `/Users/mac/Projects/siap-izin`, siapkan direktori privat (jangan mengubah izin direktori milik pihak lain). Contoh direktori hasil tugas ini:

```sh
umask 077
python3 -c 'from pathlib import Path; p=Path("/Users/mac/.hermes/outputs/siap-izin-completion-01273-20261029/operations"); p.mkdir(mode=0o700, parents=True, exist_ok=True); p.chmod(0o700)'
python3 tools/rdtr_operations.py status
```

Set `PRIVATE` ke **root privat aktual yang sudah diketahui operator**, bukan isi config/DSN. Suffix `rdtr-db/blobs` adalah lokasi arsip sumber. Contoh berikut sengaja tidak menebak root privat:

```sh
OUT=/Users/mac/.hermes/outputs/siap-izin-completion-01273-20261029/operations
BACKUP="$OUT/backup-01273-20261029"
python3 tools/rdtr_operations.py backup --output "$BACKUP" --blob-root "$PRIVATE/rdtr-db/blobs" >"$OUT/backup-result.json" 2>"$OUT/backup-error.log"
python3 tools/rdtr_operations.py status --backup "$BACKUP" >"$OUT/status.json" 2>"$OUT/status-error.log"
python3 tools/rdtr_operations.py verify-restore --backup "$BACKUP" >"$OUT/restore-result.json" 2>"$OUT/restore-error.log"
```

Gunakan output baru untuk setiap percobaan; jangan menghapus/mengganti bundle lama demi lolos. `backup` mempublikasikan bundle atomik berisi `database.dump`, `manifest.json`, `manifest.sha256`, `blobs/`. Directory `0700`, file `0600`. SHA dump memverifikasi seluruh byte custom dump. Bukti konten SQL memverifikasi tabel `rdtr` saja; full dump juga memuat objek non-RDTR tetapi isinya tidak dibandingkan satu per satu oleh drill ini. Agregasi hash tabel menggunakan memori server dan pembacaan checksum dump memakai memori host; ini alat dataset lokal, bukan solusi backup terabyte.

Output sukses adalah JSON ringkas. Error sengaja hanya `operations_failed` tanpa exception, SQL, DSN, path privat atau stderr subprocess. Jangan menyalakan traceback/log subprocess publik untuk debugging. Periksa prasyarat, izin path, dan receipt privat; rerun dengan output baru setelah akar masalah dipahami. `status` memberikan counts, ukuran DB, active pin, dan optional umur backup yang sudah lolos checksum. `healthy` berarti schema/tabel dapat dibaca, bukan sertifikasi mapping/legal/freshness atau jaminan readiness bisnis.

## Restore terisolasi dan bukti

`verify-restore` tidak menerima nama target. Ia menghasilkan `siap_izin_restore_<12hex>` baru; `createdb` gagal jika nama sudah ada, tidak reuse. Target dibuat dari `template0`, owner dibatasi, dan diberi comment marker `rdtr-operations-v1`. Receipt privat di parent bundle mencatat `.requested.json` sebelum create dan `.created.json` setelah owner/marker dibaca balik. Restore memakai `pg_restore --exit-on-error --single-transaction`, mempertahankan ownership/ACL, tidak memakai `--create` atau `--clean`.

Sesudah restore, transaksi read-only baru membandingkan **inventaris persis**: daftar semua tabel RDTR, setiap count dan hash semua kolom/baris, source EWKB, active pin, dan metadata referensi blob. Seluruh salinan blob dan dump dibaca/checksum lagi. Hanya bila semuanya cocok, receipt `.verified.json` ditulis dengan hash inventaris. Exit code pg_restore saja bukan bukti sukses. DB hasil drill **dipertahankan** baik berhasil maupun gagal; sumber dev/test tidak menjadi target restore. Salinan blob tetap berada dalam bundle; tidak ditulis ke blob root sumber dan tidak otomatis dihubungkan ke aplikasi.

Pembersihan database drill hanya oleh operator setelah memeriksa receipt exact-name, owner dan marker di catalog; tidak ada command cleanup otomatis. Jangan memakai wildcard/drop massal dan jangan pernah menghapus dev/test. `.requested` saja tidak membuktikan database benar-benar dibuat. Receipt bukan otorisasi untuk menghapus sumber. Untuk uji integrasi, parent dapat membandingkan hash inventaris sumber sebelum/sesudah drill pada keadaan tanpa writer lain; unit test hanya memakai fixture dan tidak membuktikan eksekusi restore Docker nyata.

## Retensi/WAL: usulan manual, belum diterapkan

Usulan untuk disetujui operator: backup harian 7 hari, mingguan 4 minggu, bulanan 6 bulan; simpan sekurangnya satu backup terbaru dengan receipt drill sukses dan satu salinan terenkripsi/off-host yang aksesnya terpisah. Ukur ruang disk sebelum menjalankan. Tidak ada automatic delete, cron, ataupun scheduler dalam perubahan ini. Penghapusan manual hanya setelah daftar bundle/receipt ditinjau, persetujuan eksplisit, dan salinan pengganti diverifikasi; staging gagal tidak boleh dianggap titik pemulihan.

Ini logical snapshot, **bukan PITR**, bukan replikasi, bukan backup cluster globals/roles. WAL archiving/base backup, storage terenkripsi, rotasi kunci, off-host/immutable retention, monitoring kegagalan, RPO/RTO dan latihan pemulihan cluster baru masih membutuhkan desain/otorisasi terpisah. Jangan mengaktifkan WAL retention tanpa batas kapasitas dan prosedur recycle. RPO bergantung pada interval backup manual; RTO harus diukur pada drill nyata. Drill lokal dalam cluster yang sama tidak menyertifikasi pemulihan bencana/produksi.

## Tes

```sh
python3 -m unittest tests.test_rdtr_operations -v
```

Fixture file privat dan mock subprocess/session; tidak ada dump sintetis yang dipublikasikan sebagai backup nyata, pembacaan private config/blob asli, atau SQL mutation pada dev/test dalam unit test. Jalankan backup/restore nyata hanya oleh parent/operator pada perintah terotorisasi di atas.
