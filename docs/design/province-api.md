# Kontrak eksplorasi lintas-RDTR Sulawesi Tenggara

**Status:** prototipe lokal baca-saja. Melanjutkan pembuktian Tirawuta, bukan mesin izin atau pengajuan OSS. Kontrak ini menggantikan pembatasan satu rencana dalam [kontrak pilot historis](zone-api.md).

## Inventaris dan batas cakupan

[Registry](../../tools/rdtr-plans.json) merupakan snapshot kurasi sumber, bukan discovery langsung pada setiap request. Registry mencatat 17 wilayah administratif dan 18 rencana. Enam wilayah tidak tercantum tetap memakai namespace internal/source ID null. Enam belas rencana memiliki calon relasi kegiatan; Wanggudu dan CBD Teluk Kendari beraktivitas null. Bukan bukti tidak ada RDTR atau kegiatan dilarang.

Semua pemetaan tetap belum ditinjau. Lasalimu memakai 014 bahan minuman, Labungkari 002 tanaman tahunan; Wangi-Wangi/Matahora mempertahankan nama literal 060 “Bahan Minimum”. ID lokal bukan kode KBLI. Tidak ada konversi universal 01270→01273 atau penggantian budidaya dengan industri/perdagangan. Ruang lingkup budidaya masih asumsi yang belum dikonfirmasi.

## API

- `GET /api/catalog?kbli=01273`: byte snapshot skema 1, `sourceStatus: curated_source_snapshot`, timestamp pemeriksaan, 17 regions dan 18 plans.
- `GET /api/zones?plan=<ID literal registry>&kbli=01273`: hanya query mentah allowlist, menolak encoded/duplikat/tambahan/ID tidak dikenal. Aktivitas null → HTTP 422 `activity_mapping_unavailable`, bukan koleksi kosong.
- Context immutable per rencana: URL katalog/aktivitas/layer, filterField, nativeWKID dan aktivitas tidak ditukar antarthread.
- Metadata: `plan{id,name,regionId}`, `activity{id,name,filterField,mappingReviewed:false}`, KBLI/versi/scope yang belum dikonfirmasi, filterZoneCodes, counts, URL/status/waktu sumber, coverage dan limitations.
- Fitur memiliki ID numerik asli, object_id, plan_id, activity_id/name, zone_code asli KODSZN, filter_value dari field rencana, nama/subzona/kelompok/peraturan, `evidence_status: unreviewed_mapping` dan `permission: unknown`.

## Akuisisi dan cache

Sumber publik tetap allowlisted; tidak menerima URL pengguna, kredensial, cookie atau redirect. TLS/hostname diverifikasi. Setiap request ≤16 MiB, total ≤128 MiB, total akuisisi ≤90 detik; maksimal 3 akuisisi aktif. Request rencana yang sedang sibuk segera menghasilkan HTTP 503 `plan_busy`, tidak membentuk antrean tak terbatas.

Baca katalog/aktivitas/metadata kembali, pin CRS asli, minta output 4326 dan periksa koordinat. Rekonsiliasi seluruh OBJECTID dan count sebelum mengembalikan koleksi. Batch maksimal 200 ID sekaligus URL ≤1900 byte; Matahora override 5. Filter Langara memakai KODUNK termasuk nilai bertitik; zone_code tetap KODSZN. Geometri invalid/kosong dikarantina tanpa repair.

Cache privat per rencana memakai hash konteks, validasi ulang skema/topologi, tulisan atomik dan TTL maksimal 300 detik. Fallback hanya untuk kegagalan jaringan/HTTP/deadline, bukan perubahan skema/konteks. Umur snapshot harus masih di bawah batas maksimum 3600 detik **setelah refresh gagal**, bukan hanya ketika cache pertama dibaca. Label `cached_snapshot` selalu mempertahankan timestamp asli. Cache dan raw karantina tidak disajikan oleh server atau dipublikasikan.

## Frontend dan ekspor

- Katalog direkonsiliasi fail-closed dengan roster 17 wilayah. Tidak ada inventaris atau geometri contoh ketika API gagal.
- Opt-in peta terpisah dari pemuatan katalog. Hanya KBLI/wilayah sebagai kriteria.
- Semua rencana terpilih dimuat bertahap, maksimal 3 request dan timeout 120 detik; abort/revision guard menolak hasil lama.
- Koleksi/rencana asal tetap terikat pada klik dan detail. Identitas `(planId,objectId)` mencegah tabrakan OID lintas-rencana.
- Semua fitur respons sah digambar. Daftar harus menyediakan akses keyboard ke **seluruh fitur**, bukan hanya 200 pertama; pagination dan jumlah hasil terlihat. Keberhasilan tile bukan bukti keberhasilan overlay.
- Status parsial menyebut loaded/pending/gagal/unmapped/not-listed, sumber live/cache dan timestamp per rencana. Nol hasil bukan dilarang; geometri invalid tidak diperbaiki diam-diam.
- Ekspor konfigurasi skema 3 berisi namespace wilayah, snapshot katalog, status/hitungan/provenance per rencana. Hitungan disalin dengan allowlist `matched`, `returned`, `excludedInvalid`; properti tambahan tidak boleh bocor.
- Snapshot pratinjau immutable dan unduhan identik, `containsGeometry:false`. Bukan GeoJSON/SHP/KML, parameter kandidat atau hasil kesesuaian.
- Batas 2 juta verteks per koleksi mengakomodasi Routa (1.877.978 verteks teramati). Ini batas defensif tampilan, bukan klaim performa produksi.

## Menjalankan dan menguji

```sh
python tools/dev_server.py --port 8765
python -B -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
node tests/province-browser.mjs
```

Uji browser memerlukan Chromium dan sumber publik nyata. `CHROME_BIN`, `SIAP_IZIN_URL`, `SIAP_IZIN_TEST_OUTPUT` dapat diatur. Browser memakai profil terisolasi dan menutup hanya prosesnya sendiri. Payload rusak/terlambat diinjeksikan khusus uji; bukan dataset produksi. [Bukti eksekusi](province-verification.json) dipisahkan dari spesifikasi ini.

**Kendala lingkungan 26 Oktober 2026:** resolver sistem gagal mencari domain proxy, sedangkan Google Public DNS mengembalikan alamat yang berhasil dibaca dengan TLS sah. Anton menyetujui resolver alternatif khusus proses server/uji; DNS sistem/hosts tidak diubah. Launcher sementara tetap di luar repo, bukan kebijakan DNS produksi. Server default tetap memerlukan DNS jaringan yang berfungsi.

Tidak ada klaim UAT produksi, pemetaan exact-KBLI, ITBX seluruh bidang, agronomi, hak tanah atau penerimaan OSS dari keberhasilan teknis.
