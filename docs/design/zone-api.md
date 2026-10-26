# API zona lokal — checkpoint historis Tirawuta

**Dokumen historis 25 Oktober 2026.** Untuk versi lintas-rencana berjalan gunakan [kontrak provinsi](province-api.md). Pembatasan satu rencana dan angka uji di bawah merekam checkpoint lama, bukan cakupan aplikasi sekarang.

Backend pengembangan ini menyajikan `prototype/` dan satu irisan RDTR resmi untuk sorotan **belum direview**. Tidak menyediakan kandidat bidang, luas, jalan, overlay bidang, warna izin, delapan rencana, atau proxy URL umum. Frontend telah diintegrasikan melalui endpoint di bawah.

## Instalasi dan menjalankan

Python 3.11+ (sesuai metadata dependency Shapely 2.2.0 yang dipasang); dependency geometri dipasang dalam virtual environment:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-prototype.txt
python tools/dev_server.py --port 8765
```

Buka `http://127.0.0.1:8765/prototype/`. `/` mengalihkan ke sana. Hanya loopback `127.0.0.1`, bukan server produksi. Jika port 8765 sudah dimiliki server lain, hentikan/ganti server tersebut setelah memeriksa pemiliknya; backend ini tidak mengambil alih atau menghentikannya. Pada integrasi, server statis prototipe yang dikelola agen diganti dengan backend ini.

```sh
python -B -m unittest discover -s tests -p test_zone_server.py -v
python -B tools/dev_server.py --probe-live
```

`--probe-live` membuat server sementara pada port otomatis, melakukan **satu GET API lengkap**, melewati TTL, melarang fallback, membaca seluruh body dan memeriksa panjang, JSON, hitungan, ID serta geometri. Server probe ditutup sebelum perintah selesai. Unit test hanya memakai **fixture sintetis**, bukan data nyata atau bukti resmi; test tidak mengakses internet. Jangan menyebut hasil fixture sebagai hasil live.

## Permintaan yang didukung

```http
GET /api/zones?plan=7411000000:001&kbli=01273
```

Hanya pasangan literal tersebut; urutan dua parameter boleh dibalik. Parameter wajib tepat satu masing-masing. Plan/KBLI lain, parameter tambahan, duplikat, parameter kosong, spasi, padding, perubahan kapitalisasi, angka `1273`, dan representasi percent-encoded token ditolak dengan 400. Identifier tidak di-trim, di-coerce, dipad, didekode, atau diperbaiki. Frontend harus menggunakan query literal di atas, **bukan** `URLSearchParams` yang mengubah titik dua menjadi `%3A`.

Tidak ada parameter URL, layer, SQL, filter, titik, `force`, atau path cache dari klien. SQL hanya disusun dari daftar kode zona tervalidasi milik aktivitas resmi, bukan input pengguna.

## Kontrak respons 200

`Content-Type: application/geo+json; charset=utf-8`, `Cache-Control: no-store`. Body adalah GeoJSON `FeatureCollection` dengan `features` dan top-level `meta`. Koordinat longitude/latitude EPSG:4326, tidak disederhanakan atau diperbaiki.

Setiap fitur: `type: "Feature"`, `id` sama dengan `properties.object_id`, dan Polygon/MultiPolygon valid. Properti wajib:

| Properti | Asal/nilai |
|---|---|
| `object_id` | integer `OBJECTID` |
| `zone_code` | `KODSZN` |
| `zone_name` | `NAMSZN` |
| `zone_group` | `NAMZON` |
| `regulation` | `NOTHPR` atau null |
| `plan_id` | `7411000000:001` |
| `activity_id` | `041` persis, bukan pencarian nama atau indeks |
| `activity_name` | `kegiatan` dari aktivitas 041 pada respons live |
| `evidence_status` | `unreviewed_mapping` |
| `permission` | `unknown` |

`meta` wajib:

```json
{
  "plan": {"id":"7411000000:001","name":"RDTR Kawasan Perkotaan Tirawuta","regionId":"7411000000"},
  "kbli": {"code":"01273","version":"2025","scope":"budidaya-kakao","scopeConfirmed":false,"mappingReviewed":false},
  "filterZoneCodes": ["P-3"],
  "counts": {"matched":20,"returned":20,"excludedInvalid":0},
  "source": {
    "status":"live",
    "retrievedAt":"2026-10-25T14:33:27.616781Z",
    "activitiesUrl":"<URL tetap di bagian sumber>",
    "metadataUrl":"<URL tetap di bagian sumber>",
    "geometryQueryUrl":"<URL tetap di bagian sumber>"
  },
  "coverage":"loaded-plan-matching-zones-only",
  "geometryPurpose":"display",
  "limitations":[
    "Aktivitas 041 adalah kelompok luas perkebunan tanaman aromatik/penyegar, bukan izin KBLI spesifik.",
    "Pemetaan exact KBLI 01273 versi 2025 dan cakupan budidaya kakao belum direview/dikonfirmasi.",
    "ITBX seluruh bidang belum diperiksa; tidak ada ekstrapolasi izin dari titik.",
    "Sorotan bukan persetujuan OSS, bukti hak tanah, ketersediaan lahan, atau kelayakan agronomi."
  ]
}
```

Contoh hitungan dan timestamp di atas berasal dari probe yang dicatat di bawah; daftar filter **dibaca ulang dari sumber**, bukan hardcode P-3. Nilai `<URL ...>` adalah placeholder dokumentasi, bukan isi respons sebenarnya. `source.transfers` menambahkan provenance tiap transfer aktual: URL lengkap termasuk parameter, timestamp UTC, HTTP status dan byte body. Timestamp top-level adalah awal akuisisi sumber; timestamp transfer mencatat setiap respons selesai dibaca.

`matched` = jumlah ID unik dari kueri filter; `returned` = fitur valid; `excludedInvalid` = fitur karantina. Selalu `matched = returned + excludedInvalid`. Cakupan hanya zona cocok dalam satu rencana yang dimuat, bukan seluruh Sulawesi Tenggara atau status izin seluruh bidang. `unknown` tidak berarti diizinkan atau dilarang. KBLI/version/scope di sini adalah konteks eksplorasi, bukan konfirmasi penerimaan proyek oleh OSS.

## Sumber tetap dan pengambilan lengkap

Allowlist sumber publik tanpa autentikasi:

```text
activitiesUrl:
https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7411000000&id_rtr=001

metadataUrl:
https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A8_KAWASAN_PERKOTAAN_TIRAWUTA/MapServer/0?f=pjson

geometryQueryUrl:
https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A8_KAWASAN_PERKOTAAN_TIRAWUTA/MapServer/0/query
```

Setiap request memakai Referer `https://gistaru.atrbpn.go.id/rdtrinteraktif/`, TLS default tervalidasi, tanpa kredensial, tanpa mengikuti redirect, dan `Accept-Encoding: identity`. Batas: timeout socket maksimal 20 detik per pembukaan, anggaran akuisisi 90 detik diperiksa sebelum/sesudah pembacaan, 16 MiB per respons, 64 MiB total, 10.000 ID, dan batch maksimal 200. Operasi baca yang sedang terblokir tetap tunduk pada timeout socket. Tidak ada retry tak terbatas.

Urutan validasi sebelum cache ditulis:

1. HTTP 200, tipe konten JSON/GeoJSON/text JSON yang diizinkan, panjang deklaratif/aktual, UTF-8 dan objek JSON valid. JSON dengan key duplikat, konstanta non-finite, respons `error`, atau `exceededTransferLimit` ditolak.
2. `activities.data`: tepat satu `id_kegiatan === "041"`; parse JSON string `nilai_kolom_unik`, lalu array `data`. Kode zona harus unik, tidak kosong, dan lolos grammar kode; tidak memakai daftar zona arsip.
3. Metadata harus polygon, dengan field `OBJECTID` bertipe OID serta `KODSZN`, `NAMSZN`, `NAMZON`, `NOTHPR` bertipe string. Native `extent.spatialReference.wkid` harus 4326; `latestWkid` dan spatialReference tambahan jika ada tidak boleh bertentangan. Perubahan schema/CRS gagal tertutup.
4. Query `returnIdsOnly=true` dan query terpisah `returnCountOnly=true`, dengan `where=KODSZN IN (...)` dari filter sumber. Daftar ID harus unik dan jumlahnya sama dengan count.
5. Ambil seluruh ID dalam batch 200 menggunakan `f=geojson`, `outSR=4326`, kelima field, dan `returnGeometry=true`. Periksa set ID setiap batch, duplikat lintas batch, dan keseluruhan ID. Tidak ada hasil parsial untuk respons hilang, count tidak cocok, atau transfer limit.
6. Validasi semua fitur dengan Shapely. Polygon kosong/null, topologi invalid, tipe non-polygon, koordinat non-finite/di luar range, dan ring tidak tertutup dikarantina; **tidak** memanggil `make_valid`, `buffer(0)`, menutup ring diam-diam, atau mengubah koordinat. Karantina menyimpan fitur sumber asli + object ID + alasan dalam cache privat, tidak memasukkannya ke `features`.

## Cache privat, bukan arsip terselubung

Runtime cache: `private/rdtr-cache/tirawuta-01273.json`, sudah berada di bawah aturan gitignore `private/`. Tidak ada data mentah resmi yang ditambahkan ke file publik/repo terlacak. Envelope menyimpan payload tervalidasi, karantina asli, provenance sumber, versi dan SHA-256 integritas (bukan tanda tangan autentikasi). File 0600, direktori cache 0700; temporary file ditulis/fsync dan diganti atomik **hanya sesudah** seluruh ID, schema dan geometri diperiksa. Cache dibaca ulang dengan verifikasi hash, kontrak, geometri, hitungan dan timestamp; cache rusak/masa depan tidak dipakai. Symlink cache ditolak.

TTL normal **300 detik**. Cache yang masih segar tetap dikembalikan sebagai `source.status: "cached_snapshot"`, dengan timestamp sumber asli dan `source.cacheReason: "fresh_cache_ttl"`, bukan `live`. Setelah TTL, sumber diambil ulang. Hanya kegagalan jaringan/HTTP/deadline yang boleh memakai snapshot tervalidasi berumur kurang dari **3.600 detik**, dengan alasan `upstream_network`, `upstream_http`, atau `upstream_deadline`. Ketidaklengkapan ID/count, JSON/schema error, CRS berubah, atau transfer limit tidak boleh disembunyikan oleh fallback. Refresh gagal tidak menimpa cache baik. Tidak membaca audit/arsip discovery sebagai fallback dan tidak mengambil file arsip lama diam-diam.

## Permukaan HTTP dan kesalahan

- Hanya `GET /api/zones` dan file di bawah `/prototype/`; root mengalihkan ke `/prototype/`.
- Traversal biasa/encoded/double-encoded, dotfile, symlink file/direktori, directory listing, file repo lain, serta cache tidak disajikan. Pembukaan statis memakai `openat` dan `O_NOFOLLOW` per komponen.
- Metode POST/PUT/PATCH/DELETE/OPTIONS/HEAD/TRACE/CONNECT tidak didukung (405, `Allow: GET`). Tidak menerima unggahan.
- Host harus localhost/127.0.0.1 dengan port server aktual; Origin lintas situs ditolak. Tidak ada CORS terbuka.
- Error ringkas: `{"error":{"code":"..."}}`; tidak ada stack trace, respons upstream mentah, atau path lokal.
- Status: 400 query tidak didukung; 403 host/origin; 404 path; 405 metode; 502 sumber tidak valid/gagal; 503 cache tidak tersedia; 500 kesalahan internal tersanitasi.

## Hasil eksekusi nyata — 25 Oktober 2026

Strict TDD: test pertama gagal karena implementasi belum ada; irisan query, pipeline, validasi/karantina, transport, cache, HTTP, dan probe ditambahkan lewat RED → GREEN. Regresi khusus ring tidak tertutup dan native CRS bertentangan juga terbukti RED sebelum diperbaiki. Pengujian akhir menggunakan venv GIS dengan Python 3.14 dan Shapely 2.2.0; **11 test offline lulus**. Test mencakup fixture 201 ID untuk membuktikan batch 200+1, query positif/negatif, count dan ID mismatch, transfer limit/size/truncation, HTTP/JSON/error/timeout, invalid/empty geometry, no-silent-repair, cache TTL/fallback/korupsi, dan keamanan server aktual pada port otomatis.

Pada verifikasi akhir, probe LIVE dijalankan ulang dengan `python -B tools/dev_server.py --probe-live`. Bukan request terhadap server 8765 dan bukan snapshot arsip; tabel berikut mencatat hasil yang dibaca langsung pada tahap integrasi:

| Pemeriksaan | Hasil |
|---|---|
| HTTP API | **200** |
| `source.status` | **live** |
| Mulai akuisisi UTC | `2026-10-25T14:33:27.616781Z` |
| Aktivitas | `041` — `Perkebunan tanaman aromatik/penyegar` |
| Filter aktual | `P-3` |
| Matched / returned / excludedInvalid | **20 / 20 / 0** |
| Respons API lengkap terbaca | **41.338 byte**; `Content-Length` cocok |
| SHA-256 respons | `1eaec50f72c6f42020e562facad167bc5035033e21f9e6b1e5331390e4266033` |
| Total body upstream | **278.552 byte**, 5 transfer, seluruhnya HTTP 200 |
| Verifikasi | Seluruh fitur, ID, count, JSON dan validitas geometri diperiksa; tanpa fallback |

Rincian transfer dari provenance live (URL dasar tepat seperti bagian sumber; parameter query dicatat di cache privat):

| Sumber | Selesai UTC | HTTP | Byte |
|---|---|---|---|
| Activities | `2026-10-25T14:33:28.453381Z` | 200 | 220807 |
| Metadata | `2026-10-25T14:33:28.843734Z` | 200 | 22167 |
| Query IDs, `KODSZN IN ('P-3')` | `2026-10-25T14:33:29.182519Z` | 200 | 136 |
| Query count, filter sama | `2026-10-25T14:33:29.559210Z` | 200 | 12 |
| GeoJSON, seluruh 20 ID, `outSR=4326` | `2026-10-25T14:33:30.347468Z` | 200 | 35430 |

Probe akhir membaca respons lengkap tanpa fallback dengan `completeResponseVerified: true`. Metadata/provenance adalah bagian dari body; hash respons dari pembacaan berbeda tidak dapat dibandingkan sebagai hash geometri saja karena timestamp juga berubah.

Suite akhir **11 test backend offline** kembali lulus. Frontend juga lulus 1 test kontrak dan [18 pemeriksaan browser](zone-overlay-verification.json), termasuk polygon nyata dan klik sumber; lihat [kontrak sorotan](zone-overlay.md). Batas substantif tetap: relasi exact KBLI belum direview, ITBX seluruh bidang belum diperiksa, dan penerimaan proyek OSS belum dikonfirmasi.
