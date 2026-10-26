# Pilot sorotan geometri — kontrak antarmuka dan batas bukti

**Status integrasi — 25 Oktober 2026:** API dan frontend terhubung; **20 polygon sumber nyata** tampil dan dapat diklik. **18 pemeriksaan browser lulus**, disertai 11 test backend offline dan 1 test kontrak frontend. Ini pembuktian eksplorasi satu rencana, bukan penerimaan pengguna atau persetujuan seluruh cakupan produksi. [Rekaman browser portabel](zone-overlay-verification.json).

## Versi berjalan

Perluasan lintas-rencana menggantikan pembatasan satu Tirawuta pada checkpoint di bawah. Lihat [kontrak provinsi](province-api.md); angka pengujian lama tetap bukti historis, bukan cakupan versi berjalan.

## Cakupan checkpoint historis

- Tetap satu modul eksplorasi dengan kriteria KBLI/wilayah; tidak ada input luas, jalan, kandidat bidang atau ekspor GIS.
- Pilot geometri dibatasi **RDTR Kawasan Perkotaan Tirawuta**, ID `7411000000:001`, Kolaka Timur. Tujuh rencana lain tetap inventaris metadata.
- KBLI input `01273`, versi katalog `2025`; budidaya masih asumsi ruang lingkup, belum konfirmasi pengguna.
- ID kegiatan lokal `041` merupakan calon relasi kelompok perkebunan aromatik/penyegar. ID ini bukan kode KBLI dan relasinya belum ditinjau.
- Subzona yang disorot berasal dari daftar filter kegiatan pada sumber, bukan daftar zona yang dikarang atau disamakan menurut nama.

## Arti sorotan

**Biru dengan garis putus-putus berarti relevan untuk ditelaah.** Tidak ada status hijau/merah izin yang disimpulkan dari kemiripan istilah, keanggotaan filter, atau satu sampel titik. Seluruh fitur pilot ini mempunyai `evidence_status: unreviewed_mapping` dan `permission: unknown`.

Daftar filter dapat memuat ketentuan terbatas dan/atau bersyarat. Tahap ini belum menerjemahkan seluruh syarat, memeriksa aturan setiap blok, menilai agronomi atau memastikan penerimaan OSS. Bahkan bila semua polygon berhasil digambar, jumlah polygon tersebut bukan jumlah lokasi yang sudah sesuai atau mendapat izin.

Peta tidak membuat batas kabupaten, cakupan RDTR atau bidang proyek rekaan. Hanya geometri sumber yang lolos kontrak dan validasi API yang ditampilkan. Area di luar polygon yang dimuat tetap belum dievaluasi.

## Alur data

1. Pengguna memilih KBLI/wilayah dan mengaktifkan peta publik.
2. Frontend memuat API lokal `/api/zones?plan=7411000000:001&kbli=01273`. Token allowlist dikirim literal; representasi `%3A` ditolak oleh kontrak API pilot.
3. API memakai sumber resmi yang dibatasi pada pilot, mengambil filter aktivitas serta object ID/geometri dan merekonsiliasi hasil. Bukan open proxy, tidak memakai sesi/kredensial pengguna.
4. Frontend memeriksa konteks rencana/KBLI, struktur polygon, kategori bukti, status sumber dan rekonsiliasi hitungan melalui `prototype/zone-data.js`.
5. Hanya respons yang valid digambar memakai GeoJSON Leaflet. Klik polygon maupun tombol daftar membuka provenance dan batas bukti yang sama.
6. Hasil gagal/tidak lengkap tidak diganti dengan geometri demonstrasi. Cache harus diberi label `cached_snapshot` dan mempertahankan waktu retrieval asli.

Rincian API dan cara menjalankan server berada pada [dokumentasi API](zone-api.md). Server statis `python -m http.server` hanya menyajikan aset, tidak menyediakan API geometri.

## Kontrak frontend

`FeatureCollection` harus memuat `features` serta `meta`. Properties tiap fitur meliputi ID asli, kode/nama zona, rencana, ID/nama kegiatan lokal, atribut peraturan, serta status bukti. Metadata memuat KBLI/versi/ruang lingkup yang belum dikonfirmasi, daftar kode filter, hitungan matched/returned/excludedInvalid, URL sumber, waktu retrieval dan cakupan.

- `meta.counts.matched = returned + excludedInvalid`; `returned` harus sama dengan jumlah fitur respons.
- Konteks setiap fitur harus sama dengan rencana/KBLI permintaan; ID tidak boleh duplikat.
- Geometri tampilan Polygon/MultiPolygon mempunyai koordinat geografis dan ring tertutup. Pemeriksaan topologi tetap tanggung jawab API; validasi struktur browser bukan pemeriksaan GIS penuh.
- Hanya provenance `live` atau `cached_snapshot` diterima. URL sumber hanya HTTPS ke host GISTARU yang ditentukan.
- Respons yang menyatakan pemetaan telah ditinjau atau permission selain unknown ditolak oleh pilot unreviewed-only ini. Menambah status terverifikasi kelak memerlukan kontrak dan aturan yang ditinjau, bukan sekadar perubahan warna.

## Perilaku filter dan pemulihan

- Mengubah draf tidak mengubah sorotan atau ekspor kriteria terapan; label peta menyebut KBLI yang diterapkan.
- Saat kriteria diterapkan, lapisan sebelumnya dibersihkan sebelum mengambil hasil baru. Request lama dibatalkan dan respons yang terlambat diabaikan menggunakan revisi permintaan.
- Jika Kolaka Timur tidak dipilih, tidak ada pilot geometri aktif. Tampilkan keterbatasan wilayah, bukan klaim tidak ada zona yang diizinkan.
- API gagal, JSON/konteks rusak atau timeout menampilkan kesalahan serta tombol coba ulang. Tidak mempertahankan polygon lama sebagai hasil baru.
- Kegagalan peta dasar dipisahkan dari status geometri. Keduanya tidak diartikan sebagai status izin.
- Ekspor hanya snapshot JSON konfigurasi/provenance; tidak berisi geometri atau parameter bidang. Berkas yang diunduh memakai snapshot yang sama dengan pratinjau.

## Bukti pengujian sebelum integrasi

- Reproduksi awal pada browser nyata: peta dasar tampil tetapi polygon/path sorotan nol; assertion sorotan **gagal**, bukan digantikan hasil uji UI umum.
- Uji kontrak Node diperlihatkan **RED** ketika validator belum ada, lalu **GREEN** setelah implementasi.
- Fixture unit berlabel sintetis, hanya untuk memeriksa skema; tidak disajikan sebagai sumber atau fallback peta.
- Kasus kontrak mencakup payload valid, permission/flag review tidak sah, perubahan rencana/KBLI, kode zona tidak cocok, hitungan/ID duplikat, koordinat/ring tidak valid, status/tanggal sumber tidak valid, cache dan hasil kosong.
- Regresi browser pemisahan modul: 12 assertion lulus tanpa mengaktifkan luas/jalan kembali. Hasil ini **belum** membuktikan sorotan nyata; sebelum API disambungkan status yang teramati adalah kegagalan API yang jujur.

Perintah unit yang sudah dijalankan:

```sh
node --test tests/zone-data.test.cjs
node --check prototype/app.js
node --check prototype/zone-data.js
```

## Hasil integrasi nyata

Sesi Chromium terisolasi pada `2026-10-25T14:27:12.224Z` menghasilkan 18 assertion lulus. Tidak memakai profil, sesi login atau cookie pengguna. Desktop 1512×1100 dan seluler 390×844 diuji.

- **20 matched / 20 returned / 0 excludedInvalid**; filter aktual `P-3`. Lapisan GeoJSON dan path SVG mempunyai hitungan yang sama dengan respons API, bukan hanya tile peta dasar.
- Seluruh fitur berstatus `unreviewed_mapping`, `permission: unknown`; warna biru, tanpa kesimpulan izin.
- Klik pointer browser pada titik interior yang dihitung dari geometri sumber membuka detail fitur **82**. Identitas dan timestamp pada dialog cocok dengan respons, bukan data contoh.
- Enter pada daftar membuka detail; Escape menutup dialog; ArrowRight memindahkan tab.
- Draf tidak mengubah kriteria terapan; KBLI kosong ditolak. Pilihan wilayah di luar pilot membersihkan polygon tanpa menyatakan kegiatan dilarang.
- Respons JSON rusak menghapus lapisan dan menampilkan coba ulang. Respons lama yang sengaja ditunda dari payload nyata tidak boleh memulihkan sorotan setelah filter berubah.
- JSON benar-benar diunduh dan dibaca kembali: sama dengan snapshot pratinjau, tanpa geometri, luas atau preferensi kandidat.
- Tidak ada overflow horizontal pada dua ukuran uji. CDN sengaja diblokir: gate/tombol coba ulang pulih; setelah dibuka kembali, polygon nyata tampil lagi.
- Tidak ada exception JavaScript tertangkap selama skenario.

Sesi ini membaca **snapshot cache secara eksplisit**, dengan retrieval sumber `2026-10-25T14:25:12.754767Z`. Status cache bukan klaim pembacaan live pada setiap klik. Probe live terpisah pada tahap akhir juga memperoleh HTTP 200 dan 20/20/0; rincian pada dokumentasi API.

Ini bukan pembuktian pemetaan exact-KBLI, ITBX seluruh bidang, agronomi, unggah GIS/OSS, ketersediaan sumber berkelanjutan atau dukungan lintas browser. Raw geodata, cache, screenshot dan harness berpath lokal tidak dipublikasikan. Ringkasan [18 pemeriksaan](zone-overlay-verification.json) tidak digabung dengan angka historis mockup seolah kasus unik.

## Review independen sebelum publikasi

Verdict review: **passed**, tanpa temuan keamanan atau kesalahan logika yang memblokir cakupan prototipe lokal. Delapan diff kode/tes/dependency dibaca lengkap; reviewer juga menjalankan ulang 11 test backend dan 1 test kontrak klien. Snapshot kode dicocokkan kembali sebelum commit.

Dua saran nonblokir tetap menjadi tindak lanjut: selaraskan timeout frontend 45 detik dengan anggaran akuisisi backend 90 detik, serta tambah tes langsung untuk Origin asing/duplikat dan penolakan redirect melalui opener nyata. Saat ini pembacaan yang melampaui timeout browser dapat lebih dahulu terlihat gagal; tombol coba ulang tetap tersedia. Status sumber/izin tidak boleh diubah untuk menyembunyikan kegagalan.

## Dasar teknis yang dibaca

Panduan resmi GeoJSON Leaflet dibaca pada sesi implementasi: `https://leafletjs.com/examples/geojson/`. Mekanisme `style` dan `onEachFeature` dipakai untuk tampilan serta interaksi; dokumentasi renderer tidak dijadikan dasar aturan perizinan. Mempertahankan Leaflet untuk pembuktian kecil ini bukan keputusan stack produksi atau klaim bahwa migrasi MapLibre diperlukan/tidak diperlukan.
