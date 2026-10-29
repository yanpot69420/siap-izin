# Kontrak geometri tampilan ringan · v1

Kontrak implementasi setelah baseline `d72e21a`; melengkapi [rencana optimasi](map-performance-plan.md). API sumber `/api/zones` dan TTL/fallback-nya tetap tidak berubah. Semua output berikut hanya tampilan, bukan analisis/ekspor/persetujuan izin.

**Batas fase:** ini kontrak adapter live yang masih berlaku pada prototipe. [Rancangan database mandiri](rdtr-database.md) menetapkan target sumber `local_dataset`, rilis terikat sesi dan API versi baru; belum diimplementasikan dan tidak mengubah TTL/status sumber di dokumen ini. Panel admin/sinkronisasi ditunda.

## Permintaan

- `GET /api/display?plan=<ID literal>&kbli=01273&level=overview|regional|detail[&bbox=west,south,east,north]`
- `GET /api/feature-detail?plan=<ID literal>&kbli=01273&objectId=<integer>&snapshot=<64 lowercase hex>`

Plan/KBLI harus allowlist konteks registry; tanpa activity tetap422. Tidak menerima URL/filter/CRS/parameter tambahan atau duplikat. Colon plan dan koma bbox literal, bukan normalisasi token salah. Bbox WGS84 finite, west<east/south<north, dunia -180..180/-90..90, empat angka desimal biasa yang panjangnya dibatasi; NaN/Infinity/exponent/persentase/degenerate ditolak. ID objek bilangan bulat nonnegatif aman, bukan ID rencana atau ID kegiatan. Snapshot salah409 `snapshot_changed`; OID tak ada404. Perlindungan Host/Origin/static path/GET-only lama berlaku untuk rute baru.

## Koleksi tampilan

`type:FeatureCollection`, `features` polygon/multipolygon dengan ID sumber. `meta` mempertahankan kontrak/provenance sumber per rencana (KBLI/version/scope, activity/filter, source status dan retrievedAt asli, limitations, evidence unknown). Tambahan:

```text
meta.snapshotId: SHA-256 lowercase hex, terikat konteks + seluruh isi snapshot sumber
meta.sourceCounts: {matched,returned,excludedInvalid} dari sumber asli
meta.counts: alias hitungan SUMBER untuk kompatibilitas agregator; bukan panjang hasil viewport
meta.sourceBounds: [west,south,east,north] seluruh geometri sumber valid, atau null untuk sumber kosong
meta.display: {
  algorithmVersion: 'coverage-lod-v1',
  purpose: 'display-only-not-analysis-or-export',
  level: 'overview'|'regional'|'detail',
  toleranceMeters: 100|10|1,
  method: 'coverage_simplify'|'original_preserved',
  fallbackReason: null|'coverage_invalid'|'quality_validation_failed',
  sourceFeatureCount: jumlah seluruh fitur valid snapshot,
  returnedFeatureCount: panjang features respons ini,
  originalVertices: jumlah verteks seluruh sumber asli,
  returnedVertices: jumlah verteks features respons ini,
  bbox: bbox permintaan atau null,
  validation: {featureIdsPreserved:true,geometryValid:true,coverageValid:true|false|null}
}
```

Properties tampilan merupakan projection eksplisit: `object_id`, `plan_id`, `zone_name`, `zone_code`, `zone_group`, `subzone_name`, `filter_value`, `activity_id`, `activity_name`, `permission:'unknown'`, `evidence_status:'unreviewed_mapping'`, dan `source_bounds` WGS84 fitur asli. Atribut `regulation`/detail tidak perlu diulang di payload peta. Nilai teks tidak diubah menjadi markup. Fitur kosong/invalid tidak disintesis. Daftar source IDs tidak boleh berkurang pada overview tanpa bbox.

Bbox menyaring fitur yang **batas geometri sumber aslinya berpotongan** dengan kotak, bukan mengklaim semua luas kotak punya RDTR. Tidak melakukan clipping/repair/dissolve. Geometri tampilan tetap polygon fitur lengkap, dapat melewati tepi viewport. Original-preserved mempertahankan koordinat sumber tanpa simplify, tidak mengaku hasil generalisasi. Source_bounds hanya indeks navigasi/penyaringan, bukan bidang/hak.

Backend menghitung perpotongan dengan polygon asli, **bukan sekadar overlap envelope**. Klien memeriksa ID/properties/snapshot/count sumber, menolak fitur yang envelope-nya di luar bbox, dan mewajibkan fitur yang seluruh envelope-nya termuat dalam bbox. Envelope yang hanya berpotongan sebagian tidak cukup untuk mewajibkan kehadiran: polygon asli dapat berada di luar kotak meskipun envelope-nya overlap. Kelengkapan subset pada kasus tersebut ditentukan oleh pengujian filter geometri backend, bukan dipaksakan dari geometri overview yang sudah digeneralisasi.

Sumber kosong yang sah mempunyai sourceFeatureCount/originalVertices/returnedFeatureCount/returnedVertices0, sourceBounds null, method original_preserved, fallbackReason null dan coverageValid null. Ini bukan kegagalan generalisasi dan tidak membuat polygon pengganti. Pada sumber nonkosong, original_preserved tetap harus memuat alasan fallback eksplisit.

## Detail atribut

Objek JSON bukan GeoJSON:

```text
{schemaVersion:1,planId,objectId,snapshotId,properties:<atribut sumber asli yang sudah disanitasi ZoneService>,sourceBounds,meta:<metadata sumber terikat snapshot, termasuk sourceCounts>}
```

Tidak mengirim geometri asli untuk membuka dialog. Backend/klien memastikan plan/OID/snapshot cocok. Perubahan snapshot menghasilkan409 dan petunjuk muat ulang; jangan diam-diam memasangkan gambar lama dengan atribut baru. Sumber dan metadata detail harus mempertahankan timestamp/status yang jujur.

## Turunan dan umur sumber

- Turunan di memori/cache terpisah dari cache asli; geometri/properti sumber tidak dimutasi, raw tidak dipublikasikan. Gunakan CRS meter yang benar, bukan relabel koordinat; pyproj versi terpasang 3.8.0 tersedia pada venv GIS.
- Nilai `toleranceMeters` adalah parameter generalisasi pada CRS meter, **bukan jaminan deviasi maksimum 100/10/1 meter atau ketelitian hasil survei**. Turunan tidak boleh dipakai untuk luas/topologi bidang atau pengajuan. Ketergantungan coverage memerlukan GEOS3.12+; lingkungan yang tidak mendukung harus gagal secara eksplisit, bukan melaporkan validasi yang tidak dijalankan.
- Coverage-aware hanya setelah seluruh kumpulan plan coverage-valid. Validasi seluruh output dan kesamaan ID/count per level; bila tidak aman, gunakan geometri asli berlabel. Tidak memakai per-feature simplify sebagai fallback yang dapat merusak edge bersama.
- Level dibangun sesuai kebutuhan, bukan menghabiskan waktu semua level sebelum overview pertama. Bbox bukan alasan melewati validasi snapshot/quality seluruh level.
- Turunan tidak boleh memperpanjang TTL300detik/stale maksimum<3600detik sumber. Pakai sumber adapter yang tervalidasi, periksa umur lagi setelah pekerjaan mahal. Detail tidak boleh mengambil snapshot yang telah melewati batas ini. Cache/lock per plan; error tetap independen dan tidak menjadi cached success tanpa batas. Test replay boleh memakai adapter eksplisit benchmark saja, tidak merelaksasi aturan produksi.
- ID snapshot konsisten antar level/bbox dan berubah bila konteks, geometri atau atribut sumber berubah. Umur/status response dapat berubah tanpa mengganti identitas konten; status live tidak boleh disalin ke request cache lain sebagai pembacaan baru.

## Klien

Awalnya overview tanpa bbox memuat inventaris semua16rencana terpetakan; katalog18rencana tetap terpisah. Inventaris ini menjaga daftar keyboard semua fitur. Render layer memakai collection viewport tersendiri. Metadata/count sumber tidak boleh disamakan dengan jumlah fitur layer aktif.

Level dari zoom: <=9 overview,10..13regional,>=14detail. Debounce moveend, request hanya plan dengan sourceBounds berpotongan viewport, maksimal3serentak. Abort dan revision guard pada area/zoom/kriteria, termasuk detail terlambat. Tidak fit-bounds ulang pada tiap respons viewport; overview awal hanya boleh auto-fit sekali jika pengguna belum menggeser peta. Gunakan indeks seluruh sumber untuk tombol zoom-semua.

Menelusuri daftar tidak bergantung fitur sedang berada di viewport/Canvas. Pemilihan baris dapat memindahkan peta ke source_bounds lalu meminta detail terikat snapshot. Semua5.994fitur tetap bisa ditelusuri lewat pagination. Bila level viewport gagal, jangan diam-diam menggambar detail lama/endpoint penuh sebagai pengganti; laporkan parsial/error dan bedakan area belum dimuat dari hasil kosong.

Ekspor konfigurasi tetap projection eksplisit schema3 tanpa geometry/coordinates/source_bounds/objek fitur. Tambahkan counter tampil/dimuat/sumber yang jelas dan level/renderer/cakupan seperlunya; jangan spread metadata sumber/turunan atau membawa atribut geometri ke JSON konfigurasi. Perubahan draft filter belum diterapkan tidak memengaruhi snapshot ekspor.

Counter overlay: catalogPlanCount, availableFeatureCount (null jika belum diketahui), loadedFeatureCount untuk inventaris overview, drawnFeatureCount untuk layer saat ini; viewport memuat status/level dan jumlah rencana area. Field historis highlightedFeatureCount adalah alias inventaris loadedFeatureCount demi kompatibilitas, **bukan jumlah pixel/fitur viewport**; konsumen baru harus memakai drawnFeatureCount. Metadata counts pada panel detail juga disebut fitur sumber valid, bukan fitur yang sedang tergambar.
