# Audit geometri dan sampel ITBX — pilot kakao 01273

**Status:** audit teknis terbatas selesai untuk delapan layer yang dipilih dari katalog; pemetaan exact-KBLI dan kesesuaian agronomi belum tervalidasi.
**Waktu pembacaan:** 25 Oktober 2026 (UTC tercatat pada arsip).
**Keluaran ini bukan:** kandidat lokasi, polygon 5000m2, bukti hak, persetujuan OSS atau penilaian kesesuaian tumbuh kakao.

## 1. Hasil yang benar-benar diuji

- Delapan layer dari empat kabupaten diperiksa melalui rute publik yang digunakan aplikasi GISTARU.
- Total **15859 fitur** diunduh dalam batch dan setiap object ID direkonsiliasi dengan daftar ID dari server. Tidak ada klaim bahwa angka tersebut mencakup seluruh RDTR/wilayah provinsi.
- Pengujian lokal menemukan **15848 geometri valid** dan **11 geometri invalid**; tidak ada geometri kosong atau koordinat di luar rentang geografis dalam data yang dianalisis.
- **35 sampel titik interior** diuji untuk kelompok kegiatan lokal perkebunan tanaman aromatik/penyegar. Seluruh respons cocok dengan ID wilayah, ID rencana dan subzona yang diminta.
- Hasil kategori sampel: **12 diizinkan**, **20 terbatas**, **3 terbatas dan bersyarat**. Angka ini jumlah sampel kelompok lokal, bukan jumlah lahan cocok atau penerimaan KBLI01273.

Angka integritas dan jumlah sampel merupakan hasil analisis lokal terhadap sumber yang dirinci pada tabel berikut; bukan angka resmi luas/kesesuaian lahan.

## 2. Rekonsiliasi per rencana

| Wilayah / rencana | Fitur diterima dan ID cocok | Geometri invalid | WKID sumber | Sampel titik | Sumber metadata / ID |
|---|---|---|---|---|---|
| Kab. Kolaka Timur / RDTR Kawasan Perkotaan Tirawuta | 1875 | 0 | 4326 | 1 | [1][9] |
| Kab. Kolaka Timur / RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | 2136 | 0 | 4326 | 4 | [2][10] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Kolaka | 4618 | 0 | 4326 | 6 | [3][11] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Wolo | 728 | 1 | 4326 | 7 | [4][12] |
| Kab. Konawe / RDTR Wilayah Perencanaan Routa | 3123 | 0 | 32749 | 3 | [5][13] |
| Kab. Konawe / RDTR Pondidaha | 1829 | 8 | 4326 | 2 | [6][14] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Laonti | 761 | 1 | 4326 | 5 | [7][15] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Angata | 789 | 1 | 32751 | 7 | [8][16] |

WKID sumber dipertahankan apa adanya. Server diminta mengembalikan geometri dalam EPSG:4326; geometri keluaran diperiksa, bukan sekadar mengganti label CRS. Routa dan Angata memiliki CRS sumber berbeda dari sebagian besar layer. Ini kebutuhan transformasi yang harus ditangani, bukan bukti otomatis CRS sumbernya keliru.

### Temuan mutu geometri

- Wolo: satu fitur invalid, OBJECTID `681`.
- Pondidaha: delapan fitur invalid, OBJECTID `166`, `924`, `1507`, `1520`, `1546`, `1631`, `1686`, `1737`.
- Laonti: satu fitur invalid, OBJECTID `227`.
- Angata: satu fitur invalid, OBJECTID `714`.

Alasan GEOS mencakup self-intersection/ring self-intersection. Data asli tidak diperbaiki atau ditimpa. Geometri tersebut dikeluarkan dari perhitungan gabungan diagnostik; hasil gabungan hanya mewakili fitur valid, bukan cakupan sempurna seluruh rencana. Jika kelak diperlukan perbaikan, simpan turunan, bandingkan luas/topologi dan minta review sebelum dipakai untuk keputusan.

## 3. Mengapa filter kegiatan tidak cukup sebagai kesimpulan izin

Untuk setiap pasangan rencana–subzona yang muncul pada daftar filter kelompok lokal, dipilih satu fitur valid yang relatif besar, lalu dibuat titik representatif di dalamnya. Pengujian ini hanya sampling, bukan pemeriksaan setiap fitur, seluruh blok, setiap batas, atau polygon proyek.

Tabel berikut mengacu pada **kelompok kegiatan lokal**, yang masih merupakan calon pemetaan ke budidaya kakao. Nama kegiatan mirip atau muncul pada filter tidak membuktikan penerimaan exact-KBLI01273.

| Wilayah / ID rencana | Subzona sampel | ID kegiatan lokal | Kategori respons pada titik | Sumber |
|---|---|---|---|---|
| 7411000000 / 001 | P-3 | 041 | Terbatas dan Bersyarat | [17] |
| 7411000000 / 002 | P-2 | 041 | Diizinkan | [18] |
| 7411000000 / 002 | P-3 | 041 | Terbatas | [19] |
| 7411000000 / 002 | R-4 | 041 | Terbatas | [20] |
| 7411000000 / 002 | R-5 | 041 | Terbatas | [21] |
| 7401000000 / 001 | EM | 025 | Terbatas | [22] |
| 7401000000 / 001 | RTH-8 | 025 | Terbatas | [23] |
| 7401000000 / 001 | PS | 025 | Terbatas | [24] |
| 7401000000 / 001 | R-5 | 025 | Terbatas dan Bersyarat | [25] |
| 7401000000 / 001 | P-3 | 025 | Diizinkan | [26] |
| 7401000000 / 001 | R-4 | 025 | Terbatas dan Bersyarat | [27] |
| 7401000000 / 002 | P-2 | 034 | Diizinkan | [28] |
| 7401000000 / 002 | W | 034 | Terbatas | [29] |
| 7401000000 / 002 | K-3 | 034 | Terbatas | [30] |
| 7401000000 / 002 | P-3 | 034 | Terbatas | [31] |
| 7401000000 / 002 | R-4 | 034 | Terbatas | [32] |
| 7401000000 / 002 | R-3 | 034 | Terbatas | [33] |
| 7401000000 / 002 | P-1 | 034 | Terbatas | [34] |
| 7402000000 / 003 | P-2 | 043 | Diizinkan | [35] |
| 7402000000 / 003 | P-3 | 043 | Diizinkan | [36] |
| 7402000000 / 003 | P-1 | 043 | Diizinkan | [37] |
| 7402000000 / 002 | P-2 | 016 | Diizinkan | [38] |
| 7402000000 / 002 | P-3 | 016 | Terbatas | [39] |
| 7405000000 / 002 | R-3 | 044 | Terbatas | [40] |
| 7405000000 / 002 | R-4 | 044 | Terbatas | [41] |
| 7405000000 / 002 | P-3 | 044 | Diizinkan | [42] |
| 7405000000 / 002 | P-2 | 044 | Diizinkan | [43] |
| 7405000000 / 002 | RTH-1 | 044 | Terbatas | [44] |
| 7405000000 / 001 | P-3 | 044 | Diizinkan | [45] |
| 7405000000 / 001 | R-4 | 044 | Terbatas | [46] |
| 7405000000 / 001 | R-3 | 044 | Terbatas | [47] |
| 7405000000 / 001 | P-2 | 044 | Diizinkan | [48] |
| 7405000000 / 001 | RTH-2 | 044 | Terbatas | [49] |
| 7405000000 / 001 | R-5 | 044 | Terbatas | [50] |
| 7405000000 / 001 | P-1 | 044 | Diizinkan | [51] |

### Implikasi desain

- Hasil filter harus mempertahankan kategori terbatas dan/atau bersyarat; bukan semua diwarnai hijau.
- Pada sampel P-3 Tirawuta untuk kegiatan lokal yang ditelaah, responsnya terbatas dan bersyarat.[17]
- Pada sampel P-3 Mowewe–Lalolae–Tinondo, respons memuat pembatasan luas maksimum, tetapi snapshot ini belum menetapkan angka batasnya untuk proyek.[19]
- Pada sampel P-3 Pondidaha, respons merujuk batas intensitas berbasis luas blok. Pemeriksaan tidak boleh menganggap luas proyek 5000m2 otomatis memenuhi ketentuan berbasis blok.[39]
- Label ringkas seperti kode syarat tidak boleh diterjemahkan bebas; baca dokumen dan pasal/lampiran sumber sebelum menetapkan aturan mesin.
- Hasil sampel hanya berlaku pada titik serta konteks rencana yang diperiksa. Untuk proyek, seluruh polygon tetap perlu dioverlay dan syarat spesifik ditelaah.

## 4. Dokumen dan pemetaan yang belum selesai

Atribut nomor/tahun peraturan tersedia pada sebagian besar fitur, tetapi bukan pengganti pembacaan dokumen. Kolaka memuat penulisan tahun yang perlu diperiksa terhadap sumber, bukan diperbaiki diam-diam. Atribut nomor peraturan Routa pada hasil yang diambil belum terisi. Tautan dokumen pada respons ITBX disimpan untuk penelusuran lanjutan.

Belum selesai: pembacaan seluruh batang tubuh/lampiran, makna status katalog numerik, konfirmasi pemetaan 01273 ke kegiatan lokal, kelengkapan aturan berbasis blok, serta hak pemakaian/publikasi ulang data. Inventaris sumber agronomi/jalan dan uji akses terbatas tersedia pada [matriks sumber](data-sources.md), bukan penilaian cakupan penuh atau kesesuaian bidang. Tidak ada keputusan bahwa semua kabupaten/rencana sudah terintegrasi atau layak pengajuan.

## 5. Metode dan reproduksibilitas

1. Gunakan identitas rencana dari pembacaan katalog sebelumnya, kemudian periksa metadata layer live.
2. Ambil seluruh object ID (`returnIdsOnly`), lalu ambil geometri/atribut dalam batch 200 ID. Setiap batch dicocokkan ke ID yang diminta; duplikat, hasil kurang dan transfer limit tidak diterima sebagai lengkap.
3. Simpan respons mentah beserta URL dan waktu di arsip kerja luar repo publik; simpan manifest setiap rencana.
4. Gunakan Shapely 2.2.0 untuk validitas/topologi dan pyproj 3.8.0 dengan ellipsoid WGS84 untuk perhitungan luas diagnostik. Tidak menyebut luas derajat sebagai m2.
5. Ambil titik interior dari geometri valid untuk setiap subzona filter kegiatan yang ditelaah. Cocokkan kembali wilayah, rencana, subzona dan ID kegiatan pada respons titik.
6. Pisahkan kategori izin lokal, kondisi agronomi, serta status pengajuan resmi. Tidak menyimpulkan “dilarang” hanya karena kegiatan tidak ditemukan pada salah satu array respons.

Akses metadata langsung ArcGIS memerlukan token, sedangkan proxy publik yang dikonfigurasi aplikasi mengembalikan data tanpa mengambil kredensial. Pada uji ini permintaan menyertakan Referer aplikasi resmi. Metadata dapat dibaca tidak berarti hak publikasi ulang geometri telah dikonfirmasi. Karena itu repo hanya memuat laporan agregat, bukan salinan geometri mentah.

## 6. Gerbang berikutnya

- [ ] Tinjau sumber aturan/dokumen untuk kondisi yang memengaruhi target luas dan pemetaan budidaya kakao.
- [x] Susun matriks sumber agronomi, tutupan, medan, jalan dan batas skala bukti; pemrosesan penuh tetap belum dilakukan.
- [ ] Tentukan toleransi luas, bentuk/jumlah kandidat dan kebijakan kandidat dengan bukti agronomi belum lengkap; pertanyaan ini belum dianggap disetujui.
- [x] Keluaran SHP ZIP dan KML dikonfirmasi pengguna.
- [x] Jalan tetap preferensi saja, tidak menjadi syarat gugur.
- [ ] Periksa mockup dan bedakan audit data dari kandidat rekomendasi.

## Sources

[1] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A8_KAWASAN_PERKOTAAN_TIRAWUTA/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[2] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B2_KAWASAN_AGROPOLITAN_MOWEWE_LALOLAE_TINONDO/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[3] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A4_KAWASAN_PERKOTAAN_KOLAKA_KABUPATEN_KOLAKA/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[4] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B9_KAWASAN_PERKOTAAN_WOLO/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[5] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/PARKIRAN/_RDTR_7402_WP_ROUTA/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[6] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A3_WILAYAH_PERENCANAAN_PONDIDAHA/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[7] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B6_WILAYAH_PERENCANAAN_LAONTI/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[8] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B5_WILAYAH_PERENCANAAN_ANGATA/MapServer/0/query?f=json&where=1%3D1&returnIdsOnly=true
[9] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A8_KAWASAN_PERKOTAAN_TIRAWUTA/MapServer/0?f=pjson
[10] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B2_KAWASAN_AGROPOLITAN_MOWEWE_LALOLAE_TINONDO/MapServer/0?f=pjson
[11] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A4_KAWASAN_PERKOTAAN_KOLAKA_KABUPATEN_KOLAKA/MapServer/0?f=pjson
[12] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B9_KAWASAN_PERKOTAAN_WOLO/MapServer/0?f=pjson
[13] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/PARKIRAN/_RDTR_7402_WP_ROUTA/MapServer/0?f=pjson
[14] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74A3_WILAYAH_PERENCANAAN_PONDIDAHA/MapServer/0?f=pjson
[15] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B6_WILAYAH_PERENCANAAN_LAONTI/MapServer/0?f=pjson
[16] https://gistaru-proxy.atrbpn.go.id/proxy.ashx?https://gistaru.atrbpn.go.id/arcgis/rest/services/071_RDTR_PROVINSI_SULAWESI_TENGGARA/_RDTR_74B5_WILAYAH_PERENCANAAN_ANGATA/MapServer/0?f=pjson
[17] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7411000000&latitude=-4.069887230499944&longitude=121.88758764385732
[18] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7411000000&latitude=-3.92891214149995&longitude=121.75584557181782
[19] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7411000000&latitude=-4.002185828999956&longitude=121.74836950398885
[20] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7411000000&latitude=-3.97823282899995&longitude=121.73583498070286
[21] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7411000000&latitude=-3.9574703304999446&longitude=121.81656667130324
[22] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.037804478499936&longitude=121.56089893460276
[23] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.060716420999967&longitude=121.59870189929941
[24] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.0930558249999365&longitude=121.60710167315028
[25] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.0570685564999565&longitude=121.6146630228629
[26] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.1010707849999335&longitude=121.65445526784148
[27] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-4.092784792999936&longitude=121.63525248621647
[28] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.837358701999932&longitude=121.32501541875915
[29] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.8406074119999687&longitude=121.25432722222824
[30] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.841497650499946&longitude=121.30324473438054
[31] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.8848780484999565&longitude=121.29833736867383
[32] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.830701270499958&longitude=121.29659314726342
[33] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.862937249999959&longitude=121.32662115149657
[34] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7401000000&latitude=-3.9034123459999535&longitude=121.33376150459937
[35] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7402000000&latitude=-3.083942440999948&longitude=121.82370400831286
[36] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7402000000&latitude=-2.9411397099999306&longitude=121.5572685794965
[37] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7402000000&latitude=-2.9340351034999514&longitude=121.56397740080884
[38] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7402000000&latitude=-3.983886858499943&longitude=122.25840176194492
[39] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7402000000&latitude=-4.018698162999954&longitude=122.19508503121621
[40] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.210104887499938&longitude=122.88138996362915
[41] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.185833589499936&longitude=122.87306959594966
[42] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.233563057499964&longitude=122.88229977222548
[43] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.163639751499943&longitude=122.86287597515229
[44] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.237970829999966&longitude=122.86947168250003
[45] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.104666460999937&longitude=122.15192781380429
[46] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.158063935499968&longitude=122.1766133989916
[47] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.1333418089999725&longitude=122.12277205324989
[48] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.133230482999949&longitude=122.09593241545745
[49] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.124763855499964&longitude=122.09292246535257
[50] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.111193984999943&longitude=122.12253644919454
[51] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/data?id_wilayah=7405000000&latitude=-4.128285785999935&longitude=122.1815185028322
