# Kontrak irisan baca RDTR lokal v1

Status: kontrak implementasi setelah hardening003; bukan pernyataan API/peta sudah aktif. Legacy live/TTL tetap terpisah. Seluruh data awal subset01273, dated_snapshot, izin unknown dan mapping unreviewed. Tidak ada HTTP ATR pada jalur baca, tidak ada benchmark-replay/TTL bypass, tidak ada ekspor geometri.

## Ownership dan fungsi persiapan

`tools/rdtr_dataset.py`:
- `prepare_version(conn, version_id, blob_root) -> dict`: operator pada versi staging. Baca arsip origin lewat descriptor/nofollow + checksum + codec; cocokkan fingerprint/ID/props/geometri dengan versi SQL. Pakai algoritma coverage-lod-v1 yang sudah ada (`DisplayService._snapshot/_build_level` boleh dipakai sebagai algoritma batch murni, tidak memanggil get_display/get_zones/_check_age atau memalsukan tanggal). Bangun3level overview/regional/detail,100/10/1m hanya tampilan; invalid coverage original_preserved, tidak repair.
- Simpan zone_display dengan source_geometry_hash, algorithm_version,method,parameters,qc_state/qc_result. Simpan metadata kecil di `plan_version.layer_metadata.localReadModel` (hanya sebelum publish): `{schemaVersion:1,algorithmVersion:'coverage-lod-v1',meta:<base>,sourceBounds:<bbox|null>,levels:{overview:<displayInfo>,regional:<displayInfo>,detail:<displayInfo>}}`. `displayInfo` persis metadata DisplayService._build_level. SourceCounts/counts alias tetap matched/returned/excludedInvalid asli.
- Base meta: plan{id,name,regionId},activity{id,name,filterField,mappingReviewed:false},kbli{code:'01273',version:'2025',scope:'budidaya-kakao',scopeConfirmed:false,mappingReviewed:false},filterZoneCodes,counts,coverage:'loaded-plan-matching-zones-only',geometryPurpose:'display',limitations array string,source{status:'local_dataset',retrievedAt:<waktu sumber asli>,activitiesUrl,metadataUrl,geometryQueryUrl,nativeWkid,outputWkid:4326}. Allowlist, jangan transfers/rawsource/private path. URL provenance dari context yang divalidasi, bukan fetching.
- `publish_release(conn, selections, *, channel, activate, actor) -> dict`: selections list `{plan_version_id:<uuid>,mapping_id:<uuid>}` eksplisit, satu versi perplan; m milikversi/aktivitas/01273. Validasi3LOD/QC/geometry hashes/counts/meta/source. Seal versi dan mapping tanpa mengubah review/permission. Manifest stabil: `{schemaVersion:1,sourceKind:'local_dataset',algorithmVersion:'coverage-lod-v1',partial:true,plans:[{planId,planVersionId,contentFingerprint,mappingId,mappingRevision,geometryScope,rulesScope}]}` sort planId. SHA256 atas dev_server.encoded(manifest). Dedup manifest dengan advisory lock, jangan mengubah release lama. Insert member/release_mapping lalu publish. `activate` eksplisit; pointer channel mutable. Actor adalah operator teknis, bukan reviewer hukum. Tidak aktivasi dev dari tes/agent.

## Model baca dan HTTP

`tools/rdtr_local_api.py`: fungsi `get_catalog(conn, channel='exploration')`, `get_display(conn, plan_id, level, release_hash, bbox=None)`, `get_feature_detail(conn, plan_id, object_id, snapshot_id, release_hash)`. Semua baca SQL saja, tidak membaca blob atau menggeneralisasi pada request. Caller memegang koneksi/transaksi.

`tools/rdtr_local_server.py`: `make_server(port=0, connection_factory=..., prototype_dir=...)`; CLI menggunakan load_dsn(kind='reader'), bukan owner/SETROLE sebagai pemisahan kredensial. Batas Host/Origin loopback dan static allowlist seperti server lama, GET saja, error generik, timeout query. Tidak ada /api/zones asli/fallback atau proxy. Server tidak membuat user/rilis/impor; parent menyediakan reader/login dan menjalankan persiapan.

Routes:
- `/api/catalog?kbli=01273` membaca active_release channel exploration dan mengembalikan katalog kurasi lengkap17wilayah/18rencana (bukan discovery live), ditambah top-level `localDataset:{sourceKind:'local_dataset',releaseId:<uuid>,releaseHash:<64hex>,partial:true}`.
- Tiap descriptor plan ditambah `localDataset`: kalau ada di rilis `{available:true,releaseId,releaseHash,planVersionId,mappingId,snapshotId,geometryScope,rulesScope}`; yang tidak ada `{available:false,releaseHash}`. Jangan menghapus rencana atau membuat activity=null bila hanya belum diimpor.
- `/api/display?plan=<literal>&kbli=01273&level=overview|regional|detail&release=<64hex>[&bbox=w,s,e,n]`
- `/api/feature-detail?plan=<literal>&kbli=01273&objectId=<integer literal>&snapshot=<64hex>&release=<64hex>`
- Literal ketat: tidak URLdecode/perbaikan token; duplikat/unknown/malformed400. Release lama published tetap dilayani walau active pointer berubah. Unknown release404; plan absent/unmapped422; no active/unprepared dataset503; snapshot beda valid409. Tidak fallback ke active release saat hash request salah.
- `snapshotId = sha256(encoded({releaseHash,planVersionId,mappingId,algorithmVersion:'coverage-lod-v1'}))`.
- Display/detail bentuk legacy DisplayData, tetapi source.status local_dataset dan meta.dataset `{sourceKind:'local_dataset',releaseId,releaseHash,planVersionId,mappingId,geometryScope,rulesScope}`. meta.snapshotId/sourceCounts/sourceBounds/display seperti kontrak lama. Display feature properties persis allowlist display_geometry.PROPERTY_KEYS +permission/evidence_status/source_bounds; detail properti sanitizer legacy, bukan seluruhsource_properties. Tidak ada geometry pada detail.
- Bbox seleksi lewat ST_Intersects original, bukan display/bounds. GeoJSON display DB precision cukup roundtrip double dan diuji; returnedVertices dihitung aktual. Empty/method/fallback/source counts harus tetap jujur.

## Koordinasi tes

Semua unit SQL hanya siap_izin_test, guard sebelumDDL, DROP schema hanya dalam transaksi rollback. A/B suites SERIALIZE fixture lifetime memakai session advisory lock `0x5244545254455354` sebelumDDL; tahan sampai koneksi ditutup. Migrasi tetap memakai lock sendiri. Parent tidak menjalankan SQL tests serentak. HTTP tests boleh injeksi factory/adapter yang tetap membaca SQL fixture nyata; jangan commit/drop database test untuk membagi fixture antarproses. Semua fixtures sintetis diberi label; data nyata hanya parent pada dev setelah gate.

## Tambahan satu-KBLI — kandidat 16 rencana, 29 Oktober 2026

- Katalog dapat membawa `plan.localStorage:{state:'stored'|'not_stored'}`. Ini observasi keberadaan versi/mapping 01273/2025 saat katalog dibaca, bukan keanggotaan rilis atau waktu pengamatan sumber. Field opsional; tanpa field berarti unknown. Metadata ini tidak disalin sebagai provenance immutable ke ekspor.
- `get_catalog_for_release(conn, release_hash)` memproyeksikan pin literal yang sudah divalidasi tanpa membaca/mengganti pointer. Dipakai preview operator terisolasi; bukan fallback dari hash yang gagal.
- Kapabilitas perangkat lunak opsional `localCapabilities:{displayBatchOverview:true}` divalidasi ketat dan tidak menjadi provenance dataset. Tanpa kapabilitas, klien tetap memakai endpoint per rencana.
- GET `/api/display-batch?kbli=01273&level=overview&release=<64hex>&plans=<literal_id_1>,<literal_id_2>` menerima 1–16 ID unik, tanpa bbox/level lain/parameter tambahan/URL decoding. Semua harus anggota rilis. Batas body 32 MiB, gagal eksplisit tanpa pemotongan fitur.
- Respons batch tepat `{schemaVersion:1,releaseHash,results:[{planId,data:<collection>}|{planId,error:{code,status}}]}` dalam urutan permintaan. Setiap collection identik dengan endpoint individual. Kegagalan proof rilis menolak seluruh request; kegagalan proyeksi atribut per rencana tetap dibedakan. Klien menolak hasil hilang/duplikat/asing, pin salah atau schema extra, dan tidak fallback ke rilis/endpoint lain bila batch yang diumumkan gagal.
- Proof SQL seluruh anggota tetap segar pada setiap request: dua agregat inventory/LOD berkelompok berdasarkan versi dan model hash. Tidak memakai cache kepercayaan lintas-request atau hanya memeriksa rencana yang diminta. Batch mengamortisasi proof itu sekali per request, bukan melemahkannya. Timeout statement tetap tiga detik.
- Pada overview lokal saja, jika bbox viewport sepenuhnya mencakup **bounds sumber asli** yang valid, klien dapat memakai kembali inventaris terpin yang sudah dimuat. Collection tidak diubah; `meta.display.bbox` tetap null dan record diberi `origin:'inventory_contained'`. Ini bukan respons HTTP baru atau klaim interseksi dari geometri ringan. Partial overlap, level lebih dekat, legacy/live, metadata/pin yang salah dan sumber tidak diketahui tidak memakai jalan pintas tersebut.

## Riwayat gerbang awal

135Python/56Node dan review3 menutup fondasi, bukan fitur baru ini. Persiapan/rilis/API harus mempunyai RED→GREEN, tes identity/release pointer/rollback/readonly/no-upstream, lalu impor/prepare dua sumber nyata, browser dan review sendiri sebelum perluasan. Akun aplikasi terpisah serta aktivasi lokal bukan publikasi internet. Uraian katalog KBLI yang belum diimpor tidak boleh berubah menjadi label resmi karena release disegel; pengayaan katalog kelak perlu versi/provenance terpisah.
