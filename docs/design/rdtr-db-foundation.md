# Fondasi database RDTR lokal — checkpoint implementasi

**Tanggal:** 27 Oktober 2026. **Lingkup:** pengembangan lokal, bukan rilis aplikasi/produksi.

**Pembaruan 28 Oktober 2026:** review independen ketiga lulus; migrasi 002 dan 003 sudah diterapkan serta dibaca kembali pada development. Isi seluruh 20 tabel data tidak berubah (termasuk hash geometri biner); pengulangan migrasi tidak menerapkan apa pun. Rekonsiliasi ulang 1.708 fitur terhadap arsip kembali lulus. Pembangunan LOD/API lokal sedang berjalan; peta belum dinyatakan memakai jalur baru.

## Hasil yang dibaca kembali

- PostgreSQL/PostGIS lokal, database pengembangan dan database uji terpisah.
- Namespace `rdtr`: **20 tabel data + 1 tabel migrasi**. Migrasi pertama diterapkan; pengulangan identik tidak menambah migrasi/tabel. Perubahan berkas migrasi yang sudah diterapkan ditolak.
- Dua versi rencana tersimpan; pada checkpoint fondasi belum aktif, kemudian diaktifkan pada rilis lokal dua rencana (lihat checkpoint aktivasi di bawah):

| Rencana sumber | ID literal | Fitur valid tersimpan | Karantina pada dua input ini |
|---|---|---:|---:|
| Tirawuta | `7411000000:001` | 20 | 0 |
| Routa | `7402000000:003` | 1.688 | 0 |

**1.708 geometri dan atribut** dibaca kembali dari database, lalu dibandingkan dengan arsip input. Geometri dibandingkan melalui WKB dengan kesetaraan koordinat tepat, toleransi nol; tidak memakai pembulatan, perbaikan topologi atau kesetaraan luas saja. Atribut proyeksi sumber dibandingkan seluruhnya. Impor ulang Tirawuta memakai versi yang sama dan tidak menambah fitur; observasi/impor baru tetap tercatat.

## Batas isi dan kekuatan bukti

- Input adalah **`validated_source_cache`** yang checksum-nya cocok dengan arsip beku. Bukan arsip lengkap seluruh respons HTTP/atribut ArcGIS, bukan pengambilan baru, dan bukan seluruh layer RDTR.
- Geometri asli berarti koordinat EPSG:4326 pada arsip tervalidasi, sebelum generalisasi tampilan. Tidak menyatakan koordinat native layanan belum pernah ditransformasikan.
- Kedua versi tetap `geometry_scope=filtered_subset`, `rules_scope=filter_membership_only`, `freshness_state=dated_snapshot`. Cakupan awal hanya subset terkait `01273`.
- Waktu sumber dipertahankan: Tirawuta `2026-10-26T04:40:33.779279Z`; Routa `2026-10-26T04:28:49.705475Z`. Waktu impor/validasi lokal tidak menggantikan waktu pengamatan sumber atau menjadikannya live.
- Keanggotaan filter zona direlasikan dengan kegiatan lokal; pemetaan exact-KBLI tetap `unreviewed`, kategori izin tetap `unknown`. Tidak ada matriks ITBX lengkap atau keputusan izin yang diciptakan.
- Kode/versi KBLI dicatat dari metadata arsip; uraian katalog KBLI **belum diimpor** dan berlabel eksplisit demikian. Placeholder tersebut bukan uraian resmi.
- Karantina bertaut pada run/artifact dan tidak masuk tabel fitur valid. Uji sintetis mencakup geometri invalid; jumlah nol pada dua arsip nyata ini tidak berarti seluruh korpus bebas invalid.
- Arsip, geometri, koneksi dan kredensial tetap privat/diabaikan Git. Hak cache/penyajian ulang produksi belum dipastikan.

## Alat operator yang telah dijalankan

Pasang dependensi pada lingkungan proyek, bukan interpreter sistem:

```sh
.venv/bin/python -m pip install -r requirements-rdtr-db.txt
.venv/bin/python -B tools/rdtr_database.py status
```

Seleksi bbox memakai **interseksi polygon asli**, bukan envelope atau LOD. Gunakan `version_id` yang dikembalikan `status`:

```sh
.venv/bin/python -B tools/rdtr_database.py query \
  --version <version_id> --bbox 119,-6,124,-2 --limit 100
```

Respons hanya ID/label dan metadata cakupan, bukan semua geometri/kolom mentah. Limit 1–500, `matching_feature_count`, `returned_count` dan `has_more` eksplisit. Bbox di dalam lubang polygon tidak dianggap hit. Versi tidak dikenal adalah error, bukan sumber kosong.

Impor arsip memerlukan path lokal, checksum SHA-256 **literal** dan ID rencana **literal**, diperiksa sebelum lookup/binding:

```sh
.venv/bin/python -B tools/rdtr_database.py import-archive \
  --path <arsip_privat.json> --sha256 <sha256_64_heksadesimal_kecil> \
  --plan-id <id_rencana>
```

Konfigurasi lokal privat dibaca oleh loader dengan batas host/port/database/user dan mode berkas owner-only; DSN tidak dicetak. CLI ini tetap alat administrasi pengembangan: `status/query` menurunkan role sesi ke `siap_izin_readonly`, tetapi koneksi awal melalui konfigurasi owner. Pada 28 Oktober dibuat akun aplikasi lokal terpisah `siap_izin_reader`, mewarisi role baca NOLOGIN. Koneksi riil membuktikan SELECT pada 21 tabel tersedia, tidak ada hak INSERT/UPDATE/DELETE/TRUNCATE/CREATE skema, dan probe INSERT ditolak. Kredensial acak hanya disimpan pada konfigurasi privat mode0600. API baru wajib memakai akun reader, tanpa fallback owner; ini belum sertifikasi deployment produksi.

## Verifikasi dan status review

- Baseline sebelum perbaikan review: regresi Python **103 tes lulus, 0 skipped** pada eksekusi parent.
- Baseline Node sebelum perbaikan review: **56 tes lulus, 0 skipped**.
- Termasuk 19 integrasi skema PostGIS dan 9 tes impor/query/CLI in-process pada database uji dengan rollback. Dua smoke test CLI hanya membaca database pengembangan.
- Kendala geometri/CRS, FK lintas-versi, identitas literal, permission unknown, checksum, advisory lock, idempotensi, rollback, immutability konten terpublikasi dan larangan write oleh role baca diuji. Itu bukan UAT seluruh produk/OSS.
- Review independen pertama **tidak lulus**: batas jalur/izin arsip belum ketat, kesalahan parsing konfigurasi dapat menampilkan potongan rahasia, dan perubahan identitas induk bisa merusak provenance lintas-rencana. Review juga mereproduksi mutasi objek input yang masih memakai hash arsip lama. Perbaikan dan tes reproduksi sedang dikerjakan; baseline tes di atas bukan bukti temuan tersebut sudah ditutup. Migrasi yang sudah diterapkan tidak ditulis ulang. Integrasi peta menunggu regresi dan review ulang lulus.
- Review kedua mengonfirmasi perbaikan kasus awal, tetapi **belum lulus** karena identitas master rencana masih dapat diganti di bawah versi/rilis yang sama. Perbaikan tambahan melalui migrasi baru sedang dikerjakan; migrasi lama tidak ditulis ulang dan data pengembangan tidak direset. Integrasi peta serta penerapan migrasi perbaikan menunggu review berikutnya. Baseline tes bukan pengganti gerbang ini.
- Setelah penambahan kandidat migrasi 003, parent menjalankan **135 tes Python dan 56 tes Node, seluruhnya lulus**. Preflight 002 dan 003 juga lulus pada dua rencana nyata dalam transaksi **read-only**; tidak menjalankan DDL. Pada checkpoint ini database pengembangan masih hanya memiliki migrasi 001, 1.708 fitur dan nol rilis aktif. Hasil review akhir belum diterima; angka tes ini bukan pernyataan bahwa migrasi perbaikan sudah diterapkan.
- Checkpoint sesudahnya: review ketiga **lulus**, dengan 78 tes relevan serta 15 probe SQL tambahan. Parent memverifikasi ulang hash kode/migrasi terhadap review, menerapkan hanya 002/003 di development, membandingkan hash seluruh 20 tabel sebelum/sesudah, lalu membaca ulang ledger melalui koneksi baru. Ketiga migrasi tercatat dan pengulangan menghasilkan daftar kosong. Tidak ada fitur/versi/rilis aktif yang ditambah atau dihapus oleh hardening. Riwayat review gagal di atas dipertahankan, bukan status akhir yang masih terbuka.
- Jaminan race arsip adalah penulisan privat pada direktori yang dipin descriptor, bukan jaminan bahwa path direktori tidak bisa diganti oleh pemiliknya. Penggantian path tidak mengalihkan penulisan; stabilitas locator memerlukan direktori induk yang dikuasai operator. Limit bbox membatasi respons, bukan otomatis membatasi biaya count/intersection atau jumlah histori pada status administratif.
- Bukti rinci dan rekonsiliasi input/DB disimpan **di luar repo** pada keluaran privat fondasi database; tidak menyertakan blob/DSN ke dokumentasi publik.

## Riwayat checkpoint irisan baca lokal — sebelum aktivasi

Pada 28 Oktober, kode persiapan/API dan dukungan frontend telah digabung. Parent menjalankan 165 tes Python dan 68 tes Node, seluruhnya lulus. Tiga level tampilan untuk dua rencana nyata menghasilkan **5.124 baris LOD**; 1.708 geometri asli tidak berubah. Rilis percobaan hanya dibuat di transaksi yang dipaksa rollback, sehingga tidak ada versi tersegel, rilis tersimpan atau pointer aktif.

Respons SQL nyata untuk katalog, overview, viewport dan detail kedua sumber juga diterima validator JavaScript. Frontend lulus review independen terpisah. Ini belum bukti browser nyata atau kelulusan backend: review backend terputus oleh batas layanan sebelum verdict, tetapi probe yang tersimpan menunjukkan kasus publikasi state yang tidak didukung, seluruh fitur dikarantina, dan perubahan karantina sesudah persiapan. Perbaikannya kini tersedia di working tree, dengan migrasi additive `004_quarantine_publication_seal.sql` yang **belum diterapkan di development**. Parent menjalankan ulang **171 tes Python dan 68 tes Node, seluruhnya lulus**; regresi migrasi 003 tetap diuji tersendiri pada subset berkas 001–003. Review akhir berikutnya mengonfirmasi penutupan kasus state/karantina lewat 116 tes relevan dan probe privat, tetapi **tidak lulus** karena tiga contoh atribut zona diterima publisher lalu ditolak reader. Parent mereproduksi kegagalan sebelum memperbaiki validasi scalar di `_validate_prepared`; subzona numerik serta nama/kelompok zona 4.001 karakter kini ditolak sebelum seal/pointer berubah, tanpa melonggarkan reader. Regresi penuh sesudahnya **173 tes Python dan 68 tes Node lulus**. Review penutupan independen atas delta ini masih berjalan; backend belum dinyatakan lulus.

Pemeriksaan baca-saja pada dua versi development membuktikan persiapan v1 yang telah tersimpan masih diterima validator setelah perbaikan: hash untuk karantina kosong tetap kompatibel, tanpa refresh atau perubahan waktu sumber. Hash migrasi 001–003 tidak berubah dan prapemeriksaan baca-saja 004 lulus. Pembacaan ulang tetap menunjukkan **3 migrasi, 1.708 fitur asli, 5.124 LOD, 0 rilis dan 0 pointer aktif**.

Probe awal read-only dua rencana dalam kondisi hangat mengukur katalog sekitar0,37detik dan overview Routa sekitar0,46detik, bukan benchmark UI atau proyeksi performa16rencana. Validasi masih memindai seluruh anggota rilis/LOD pada tiap request; risiko amplifikasi biaya tetap perlu dipantau. Timeout tidak dinaikkan untuk menyembunyikan masalah.

Server integrasi loopback terpisah memakai akun reader riil dan membatasi transport Python `socket.create_connection` ke loopback; ini bukan firewall seluruh proses. Uji HTTP awal membuktikan static200, katalog503 tanpa rilis aktif, private path404, POST405 dan Origin asing403. Server ini belum menggantikan jalur aplikasi lama. Uji browser positif menunggu perbaikan, review backend dan aktivasi lokal yang tervalidasi.

## Checkpoint aktivasi dan browser nyata — 28 Oktober 2026

- Review penutupan independen **lulus**: 23 hash cocok, delta producer/tests terisolasi dan 12 probe SQL nyata ulang lulus. Review yang terputus di atas tidak dihitung sebagai persetujuan.
- Migrasi additive **004 diterapkan dan dibaca kembali**. Seluruh 20 tabel data identik sebelum/sesudah migrasi; 001–003 tidak diubah.
- Satu rilis development nyata diaktifkan pada channel `exploration`, berisi **Tirawuta20 + Routa1.688**. Pembacaan melalui akun reader mengonfirmasi **4 migrasi, 1.708 fitur asli, 5.124 LOD, 2 versi tersegel, 1 rilis dan 1 pointer aktif**. Tabel sumber/geometri/tampilan tidak berubah oleh publikasi.
- Pemeriksaan tambahan full-row JSON aggregate sempat melewati timeout reader3detik setelah aktivasi telah commit. Tidak mengulang aktivasi atau menaikkan timeout aplikasi: pembacaan ulang read-only membuktikan katalog dan overview kedua rencana berhasil pada budget3detik. Kegagalan verifikasi redundan ini tetap tercatat pada bukti privat.
- Server integrasi `127.0.0.1:8769/prototype/` benar-benar menyajikan jalur SQL-only. Browser Chrome berprofil scratch, bukan browser pengguna: run awal15pemeriksaan dan run diperluas **20pemeriksaan lulus**. Inventaris1708ID tepat; klik native pada interior SVG membuka identitas Routa yang diprediksi; sentuh mobile menerapkan filter Kolaka Timur dan membuka detail Tirawuta20fitur. Tidak ada exception JS, request ATR atau fallback geometri asli.
- Tanggal sumber26Oktober tetap, pin rilis sama di semua request. Label subset/unknown/unreviewed tetap tampil. Desktop focal/mobile focal memperlihatkan polygon biru; mobile tidak overflow horizontal. Tingkat cakupan tetap parsial.
- Readiness dari opt-in pada dua run tercatat4614ms dan4170ms; bukan benchmark produksi atau pembuktian percepatan kausal terhadap jalur lama. Basemap/Leaflet tetap memakai layanan internet terpisah.

## Checkpoint impor staging lanjutan — 28 Oktober 2026

Setelah izin lanjutan Anton, 11 arsip tersisa diimpor dalam batch 4/4/3. Digabung batch pertama, seluruh **14 arsip tambahan** sudah masuk staging: **4.286 fitur valid + 15 karantina**. Tidak ada perbaikan geometri otomatis atau penggantian waktu pengamatan sumber.

Verifikasi akhir dilakukan read-only lewat koneksi baru dan akun reader: himpunan 14 ID rencana tepat tanpa duplikasi; blob privat dicek ulang dengan SHA-256 dan codec; seluruh geometri asli melalui WKB, atribut, match key, kegiatan, target filter, karantina dan tanggal sumber direkonsiliasi terhadap arsip. Semua cocok. Data tambahan masih belum dipublikasikan, mapping unreviewed, dan belum memiliki LOD.

**Keadaan database terbaru:** 16 versi rencana, **5.994 fitur valid**, **15 karantina**, **6.009 matched**, 5.124 LOD, 2 versi tersegel, 1 rilis dan 1 pointer aktif. LOD/rilis tetap hanya Tirawuta–Routa. Katalog HTTP dibaca kembali berstatus200 dan hash rilis aktif tidak berubah: **peta tetap menampilkan dua rencana/1.708 fitur**, bukan seluruh data staging.

Ini rekonsiliasi penyimpanan subset arsip, bukan audit aturan provinsi, exact-KBLI, seluruh layer RDTR atau penilaian izin. Impor selesai tidak berarti rilis16rencana siap diaktifkan.

## Belum selesai / tidak diubah

1. Persiapan dan pemeriksaan LOD untuk14rencana staging, kandidat rilis baru serta pengujian sebelum aktivasi. Impor arsip sudah selesai; rencana tambahan belum dihitung sebagai isi rilis aktif.
2. Uji performa/geometri/interaksi setelah perluasan. Biaya validasi seluruh anggota/LOD pada setiap request masih merupakan batas desain; performa16rencana belum disahkan.
3. Server legacy pada port lain tidak dialihkan/dihentikan. Jalur baru tersedia di server integrasi8769; hasil browser ini tidak mensertifikasi seluruh alur lama/live.
4. Matriks aturan lengkap, review exact-KBLI, konfirmasi hak data produksi, deployment/backup/retensi produksi.
5. Panel admin, sinkronisasi terjadwal, publikasi dataset dan pengajuan OSS tetap ditunda. Publikasi kode/commit/push diizinkan terpisah oleh Anton pada 29 Oktober 2026, tanpa menyertakan database, geometri atau kredensial; lihat [checkpoint publikasi kode](local-release-checkpoint.md).

Lihat [model target](rdtr-database.md), [kontrak SQL](rdtr-db-schema-contract.md) dan [roadmap](../roadmap.md). Rilis aktif tersebut hanya development lokal dua rencana, bukan publikasi internet atau penerimaan OSS.
