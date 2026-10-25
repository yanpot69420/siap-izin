# Inventaris sumber data — pilot kakao

**Status: usulan siap review, belum disetujui.** Pemeriksaan dilakukan **25 Oktober 2026, WITA (UTC+08:00)**, berdasarkan waktu mesin. Ini audit sumber dan uji akses terbatas, bukan analisis kandidat, survei lapangan, validasi izin atau persetujuan development.

## 1. Ruang lingkup dan arti status

Mengikuti [README](../../README.md), [discovery pilot](pilot-kakao.md) dan [keputusan](../decisions.md): input `01273`; asumsi kerja **budidaya kakao**; wilayah Kolaka Timur, Kolaka, Konawe dan Konawe Selatan; target `5000m2` per kandidat. Jalan **hanya preferensi**. Tanah siap transaksi, bukti hak dan realisasi usaha bukan prasyarat rekomendasi rencana.

Pisahkan tahap pembuktian berikut:

- **Metadata terbaca:** halaman, katalog atau deskripsi layanan benar-benar diperoleh; belum membuktikan nilai raster tersedia di seluruh wilayah.
- **Respons data lengkap untuk sampel:** payload JSON/XML atau potongan raster kecil diterima sampai selesai dan strukturnya diuji; bukan seluruh data pilot.
- **Akses parsial:** hanya rentang byte awal objek diterima. Header TIFF dapat dibaca, tetapi nilai piksel wilayah belum dianalisis.
- **Terhambat:** kegagalan jaringan, halaman pengganti atau dokumen hasil pindai belum terbaca; tidak berarti sumber tidak ada.

**Tidak ada layer yang pada audit ini sudah diunduh, dipotong, diperiksa NoData dan dihitung cakupannya untuk seluruh empat kabupaten.** Cakupan nominal di tabel berikut berasal dari deskripsi penyedia, bukan hasil overlay batas administrasi. Titik/kotak uji dipilih untuk menguji akses di sekitar wilayah studi, bukan usulan lokasi usaha; keanggotaannya dalam kabupaten belum diuji.

## 2. Matriks kelayakan sumber

| Variabel / sumber primer | Cakupan, waktu dan resolusi yang didokumentasikan | Gratis, akun, lisensi / penggunaan | Hasil pemeriksaan dan batas penggunaan pilot |
|---|---|---|---|
| Elevasi / **Copernicus DEM GLO-30** | Nominal global, grid sekitar 30 m; sumber utama akuisisi 2011–2015. Ini **DSM**, termasuk vegetasi/bangunan, bukan DTM permukaan tanah.[11] | GLO-30/GLO-90 berlisensi gratis dengan pemberitahuan atribusi; portal CDSE memakai registrasi. Distributor publik menyediakan jalur COG anonim; ketentuan Copernicus tetap berlaku.[11][13] | Halaman dan indeks distributor terbaca; sampel objek HTTP 206 dan header TIFF valid.[13][31] Layak diuji untuk konteks elevasi serta **turunan lereng**, bukan survei medan bidang. Versi mirror tidak boleh diasumsikan sama dengan rilis CDSE paling baru. |
| Hujan / **CHIRPS v3, CHC UCSB** | Daratan 60°LU–60°LS, semua bujur; 1981–mendekati kini; grid 0,05°. Final dan preliminary terpisah. Hujan bulanan/pentad adalah dasar produk; data harian merupakan disagregasi.[8] | Halaman penyedia menyebut public domain sekaligus CC BY 4.0; usulan konservatif: simpan ketentuan itu dan penuhi atribusi CC BY 4.0, jangan menyimpulkan bebas atribusi. Direktori HTTP publik berhasil diakses tanpa akun.[8][45] | Metadata dan direktori terbaca; objek bulanan Januari 2020 hanya diuji dengan HTTP Range, belum diunduh penuh.[45] **Usulkan v3**, bukan memulai ketergantungan baru pada v2 yang produksinya dijadwalkan berakhir sesudah Desember 2026.[7] Belum ada normal hujan pilot yang dihitung. |
| Suhu / pembanding hujan / **NASA POWER** | Data meteorologi pada resolusi sumber 0,5° × 0,625° menurut panduan API; terlalu kasar untuk membedakan bidang berdekatan.[5] | Sampel API tanpa akun/kunci berhasil. Penjelasan layanan pengguna NASA menyebut public domain, tanpa biaya, termasuk penggunaan komersial dengan pengakuan sumber; penjelasan tersebut bertanggal 20 April 2020, bukan lisensi baru tahun 2026.[23][42] | JSON harian `T2M` dan `PRECTOTCORR` lengkap untuk satu titik, 1–7 Januari 2020.[23] Ini uji akses, **bukan** klimatologi. Jangan menjadikan elevasi pada respons POWER sebagai pengganti DEM lokal; penyedia menjelaskan nilainya mewakili grid sumber.[37] |
| Iklim observasi / **BMKG Data Online** | Data stasiun, bukan grid bidang. Lokasi stasiun, panjang rekaman, relokasi, mutu dan cakupan empat kabupaten belum diaudit. Portal menyediakan parameter iklim harian dan menyatakan maksimal unduhan 30 hari.[38] | Halaman publik dapat dibaca; jalur unduh meminta registrasi/login. Tidak membuat akun. Tarif, ketentuan redistribusi dan kelayakan penggunaan komersial data historis **belum dipastikan**.[38] | Retry dengan curl berhasil membaca halaman sesudah klien Python gagal TLS. **Tidak mengunduh rekaman iklim**. Usulan sumber validasi lokal berikutnya, bukan dependensi anonim yang telah siap. |
| Cuaca / **BMKG Data Terbuka** | Halaman menyajikan prakiraan tiga harian, gempa dan nowcast; bukan bukti tersedianya rekaman normal hujan/suhu jangka panjang untuk agronomi.[39] | Halaman publik; mewajibkan atribusi BMKG pada aplikasi/sistem. Jangan mengalihkan ketentuan portal ini secara otomatis ke data historis Data Online.[39] | Halaman HTTP 200 diperoleh lewat curl. Tidak mengambil payload cuaca karena bukan variabel klimatologi yang diperlukan. |
| Tanah / **ISRIC SoilGrids 2.0** | Prediksi global 250 m, enam interval kedalaman sampai 200 cm, bukan observasi tanah setiap bidang.[4] Tersedia pH air, fraksi tekstur, karbon organik, CEC dan ketidakpastian; **kedalaman interval prediksi bukan kedalaman efektif tanah**.[18] | CC BY 4.0; WCS/WebDAV tersedia. Dokumentasi menyatakan REST API sedang dijeda tanpa estimasi pulih, sehingga jangan membuat REST sebagai jalur wajib.[17][19] | WCS capabilities dan DescribeCoverage terbaca; subset pH 0–5 cm berhasil diunduh lengkap dan didekode.[30][34][46] Bukan seluruh kedalaman/variabel/kuantil, bukan validasi tanah. Drainase lapangan, muka air dan lapisan penghambat tetap belum diketahui. |
| Tutupan / **ESA WorldCover 2021 v200** | Peta global nominal 10 m, 11 kelas, tahun 2021; distribusi tile 3° × 3°. Jangan menafsirkan selisih peta 2020/2021 sebagai perubahan murni karena algoritmanya berbeda.[9] | Gratis, CC BY 4.0 dan atribusi proyek/Copernicus. Viewer/Terrascope memakai login; **S3 publik** merupakan jalur yang diuji tanpa akun.[9][32] | Metadata terbaca dan sampel byte objek diterima, belum analisis piksel pilot.[32] Layak sebagai konteks historis. Tree cover bukan identifikasi kakao, batas kawasan hukum, hak tanah atau izin pembukaan lahan. Tahun 2021 tidak membuktikan kondisi 2026. |
| Jalan / **OpenStreetMap** | Vektor dengan detail dan tanggal sunting berbeda per objek; tidak memiliki resolusi meter seragam. Kelengkapan jaringan empat kabupaten belum diaudit.[14][24] | ODbL, atribusi OpenStreetMap/contributors dan kewajiban lisensi basis data yang berlaku; jangan menyebutnya CC BY atau domain publik. API baca bbox berhasil tanpa akun; penggunaan berskala besar harus mengikuti kebijakan layanan, bukan membanjiri API penyuntingan.[14][15] | XML bbox kecil lengkap dan berisi objek jalan.[24] Pakai untuk **preferensi kedekatan geometris**, bukan bukti akses kendaraan, akses legal, kualitas atau konektivitas. Tag `access`, `surface`, kelas dan umur data perlu dinilai terpisah. |
| Air permukaan / **EC JRC Global Surface Water v1.5** | Produk agregat 1984–2024, sekitar 30 m; halaman diperbarui 15 Oktober 2026. Ada perubahan Collection 1/2 dan kemungkinan pergeseran ko-registrasi; Monthly Recurrence memiliki isu yang belum dikoreksi.[10][27] | Gratis menurut ketentuan Copernicus, dengan pengakuan dataset/publikasi dan atribusi peta EC JRC/Google. Endpoint distribusi publik berhasil diakses tanpa akun.[10][36] | Panduan PDF lengkap terbaca dan header tile occurrence diterima parsial.[27][36] Gunakan sebagai **indikasi riwayat deteksi air**, bukan peta bahaya banjir, lama genangan akar, tinggi air tanah atau bukti bebas banjir. `0` dan NoData tidak sama.[27] |

**Penilaian lisensi di atas merupakan catatan discovery, bukan pendapat hukum.** Sebelum distribusi aplikasi/ekspor, arsipkan ketentuan untuk versi yang dipakai, lengkap dengan atribusi dan pemeriksaan apakah gabungan basis data memerlukan perlakuan lisensi terpisah. Gratis akses tidak sama dengan bebas syarat, tanpa biaya komputasi, atau jaminan uptime.

## 3. Observasi akses yang dapat direplikasi

Seluruh observasi berikut bertanggal **25 Oktober 2026 (WITA)**. Angka byte adalah hasil permintaan nyata, bukan perkiraan ukuran unduhan. URL persis ada pada sumber bernomor; query tidak disingkat dalam daftar sumber.

| Uji | Hasil HTTP / isi yang diperoleh | Yang sudah dan belum dibuktikan |
|---|---|---|
| NASA POWER titik `121.8,-4.0`, 1–7 Januari 2020 | **200**, JSON **775 byte**, kedua parameter masing-masing tujuh nilai, `fill_value=-999`, waktu `LST`.[23] | Respons sampel lengkap; nilai/uji ini tidak boleh dipakai untuk menyatakan lokasi cocok atau mewakili normal tahunan. |
| OSM bbox `121.59,-4.06,121.60,-4.05` | **200**, XML **2.817.151 byte**; parser menemukan **155 way** bertag `highway`.[24] | Data sampel lengkap. API dapat mengembalikan simpul/way melampaui bbox untuk kelengkapan objek; hitungan tersebut **bukan** inventaris jalan yang seluruhnya terletak di kotak/kabupaten. Tidak menghitung jarak kandidat. |
| SoilGrids WCS pH `0–5 cm mean`, bbox `121.79,-4.01,121.80,-4.00` | **200**, TIFF **625 byte**, **4 × 4** piksel; header dibaca dan 16 nilai numerik terdekompresi. Request tidak memaksa grid menjadi 10 m.[46] | Subset nyata, bukan sekadar capabilities. Output direproyeksi EPSG:4326; resolusi output tidak menggantikan dukungan informasi native 250 m. Belum memperoleh kuantil atau seluruh profil. |
| Copernicus tile `S04_00_E121_00` | **206**, `Content-Range: bytes 0-65535/43381669`; diterima **65.536 byte**, header TIFF **3600 × 3600**.[31] | **Parsial**, bukan tile lengkap; belum menghitung elevasi/lereng lokasi mana pun. |
| WorldCover `S06E120_Map` | **206**, `bytes 0-65535/29162800`; **65.536 byte**, header **36000 × 36000**.[32] | **Parsial**, belum mengekstrak kelas tutupan kandidat. |
| CHIRPS v3 bulanan `2020.01.cog` | **206**, `bytes 0-65535/28809411`; **65.536 byte**.[45] | **Parsial**, belum membangun deret waktu atau memeriksa validitas seluruh piksel pilot. |
| JRC v1.5 occurrence tile `120E_0N` | **206**, `bytes 0-65535/87480069`; **65.536 byte**, header **40000 × 40000**.[36] | **Parsial**, belum menghitung persentase air; codec pembacaan piksel juga belum diuji. Panduan **1.142.853 byte** diunduh lengkap dan dibaca.[27] |
| BMKG Data Online / Data Terbuka | Klien Python gagal negosiasi TLS; curl berhasil **200**, masing-masing HTML **60.523** dan **20.578 byte**. Data Online berakhir di `/dataonline-home`.[38][39] | Yang berhasil adalah **halaman**, bukan file observasi stasiun. Tidak login, membuat akun, atau mencoba melewati pembatasan. |

Permintaan tile dibatasi pada rentang byte awal; tidak menjalankan sinkronisasi bucket atau unduhan global. Uji di atas membuktikan jalur akses pada saat pemeriksaan saja. Tidak mengekstrapolasi keberhasilan satu objek menjadi kelengkapan empat kabupaten.

## 4. Referensi syarat tumbuh dan masalah akses Kementan

- **FAO Ecocrop, Theobroma cacao kode 2074:** lembar parameter berhasil dibaca, termasuk pemisahan *optimal* dan *absolute*. Ini basis referensi umum, bukan evaluasi kelas lahan lokal atau ambang perizinan.[1]
- **ICCO Growing Cocoa:** bagian iklim, tanah, naungan dan drainase berhasil dibaca; dipakai sebagai pembanding institusional, bukan digabung diam-diam menjadi satu standar.[3]
- **Ditjenbun:** indeks resmi menampilkan Permentan Nomor 48 Tahun 2014 tentang pedoman budidaya kakao yang baik; indeks saja tidak membuktikan isi tabel atau status keberlakuan hukumnya.[16]
- Dua URL `repository.pertanian.go.id` yang diuji, halaman item benih dan bitstream buku budidaya, gagal resolusi DNS. Endpoint lama `https://ditjenbun.pertanian.go.id/tinymcpuk/gambar/file/GAP%20KAKAO.pdf` mengembalikan **404**. Tidak mengambil angka dari cuplikan mesin pencari sebagai pengganti pembacaan isi.
- **Alternatif resmi JDIH BPK berhasil:** URL `/Read/192280/...pdf` ternyata **HTML viewer**, bukan PDF.[43] Tautan `/Download/192280/...pdf` kemudian mengirim PDF: pemeriksaan awal dibatasi 5 MiB, lalu unduhan lengkap terbatas maksimal 30.000.000 byte berhasil menerima **26.795.600 byte**.[44] Ekstraktor mendeteksi **96 halaman** dan meminta OCR halaman 4–96. **Isi agronomi hasil pindai belum dibaca/ditranskripsi**; dokumen tersedia bukan berarti ambangnya sudah terverifikasi.

Rujukan numerik dan perbedaan FAO/ICCO ada pada [rubrik indikatif](../design/scoring-rubric.md). Dokumen Kementan/BPK merupakan referensi yang dapat dibaca publik, tetapi lisensi publikasi ulang berkas lengkap tidak diperiksa; jangan menaruh salinannya di repo.

## 5. Batas skala `5000m2`

`5000m2` = **0,5 ha**, atau persegi bersisi sekitar **70,7 m**. Perbandingan berikut merupakan perhitungan geometris ilustratif dari grid nominal, **bukan** hitungan sel valid atau ukuran akurasi:

| Grid nominal | Luas kandidat dibanding satu sel | Implikasi usulan |
|---|---:|---|
| 10 m | sekitar 50 sel-ekuivalen | Membantu membaca pola tutupan; batas piksel, salah kelas, tanggal dan ketelitian posisi tetap penting.[9] |
| 30 m | sekitar 5,6 sel-ekuivalen | Terlalu sedikit untuk mengklaim kemiringan mikro, drainase atau batas air presisi bidang.[11][27] |
| 250 m | sekitar 0,08 sel-ekuivalen | Kandidat lebih kecil daripada satu sel tanah; beberapa kandidat bisa menerima prediksi tanah yang sama.[4] |
| 0,05° dan 0,5° × 0,625° | jauh lebih besar daripada bidang | Hujan/suhu merupakan konteks regional; resampling ke grid halus tidak menambah bukti lokal.[8][5] |

**Kesimpulan desain:** polygon rencana boleh memiliki geometri terukur, tetapi ketelitian geometri bukan ketelitian seluruh atribut kesesuaiannya. Jangan membentuk petak kecil agar tampak homogen hanya karena raster kasar diinterpolasi. Tidak ada dasar untuk klaim “cocok lapangan”, “pasti mendapat izin”, atau “siap NIB”.

## 6. Paket lanjutan yang diusulkan, belum dilaksanakan

1. Tetapkan versi sumber, periode iklim dan rubrik bersama reviewer agronomi; OCR/review bagian syarat tumbuh Kementan sebelum menjadikannya acuan lokal. Jangan mengaktifkan ambang otomatis hanya karena tautan PDF sudah tersedia.
2. Dapatkan batas administrasi yang sesuai, lalu uji mosaic/clip dan luas data valid **masing-masing** empat kabupaten. Ukur lubang cakupan, mask laut, NoData dan tanggal; tidak memaksakan kuota kandidat per kabupaten.
3. Unduh subset analisis yang benar-benar diperlukan: DEM dengan buffer penghitungan lereng, CHIRPS v3 final multi-tahun, suhu POWER pada grid sumber, SoilGrids lintas kedalaman beserta kuantil, WorldCover serta JRC versi terkunci. Uji codec dan semantik NoData, tidak memakai WMS/RGB sebagai nilai raster analitis.[9][19]
4. Audit kelengkapan jalan dan definisi kelas yang akan digunakan. Jarak jalan yang belum diketahui tetap kosong, bukan nol atau alasan gugur.
5. Verifikasi izin penggunaan/atribusi sebelum menerbitkan peta dan ekspor. Jangan mengunggah snapshot mentah, metadata kontributor OSM, PDF sumber, data klien atau artefak kerja ke repo publik.

**Kesenjangan penting:** belum ada bukti tanah efektif/drainase setempat, normal iklim yang diproses, validasi genangan/banjir, inventaris jalan lengkap, tutupan terkini, atau kesesuaian kegiatan/zona per polygon. Semua harus tetap terlihat sebagai **belum diketahui**, bukan lulus otomatis.

## Jejak audit lokal

Snapshot publik, observasi HTTP, ukuran, SHA-256 dan bukti teks mula-mula disimpan **di luar repositori** pada scratch `siap-izin-source-checks-child`; pemetaan nomor sumber memakai ledger terpisah `siap-izin-sources-child.json`. Pada integrasi, salinan bukti dan ledger disalin ke arsip kerja lokal di luar repo beserta manifest hash agar tidak hanya bergantung pada scratch yang dapat dipangkas. Payload POWER/OSM dan dimensi TIFF subset tanah diperiksa kembali. Nomor sumber lokal dokumen ini tidak menggantikan nomor pada dokumen discovery lama. Rujukan URL di bawah memungkinkan verifikasi ulang, bukan jaminan hasil respons masa depan sama.

## Sources

[1] https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2074 — fao-ecocrop
[3] https://www.icco.org/growing-cocoa — icco-growing
[4] https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs.html — soilgrids-faq
[5] https://power.larc.nasa.gov/docs/tutorials/service-data-request/api — power-api-docs
[7] https://www.chc.ucsb.edu/data/chirps — chirps2
[8] https://www.chc.ucsb.edu/data/chirps3 — chirps3
[9] https://esa-worldcover.org/en/data-access — worldcover-access
[10] https://global-surface-water.appspot.com/download — jrc-download
[11] https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM — cop-dem-official
[13] https://copernicus-dem-30m.s3.amazonaws.com/readme.html — cop-dem-readme
[14] https://www.openstreetmap.org/copyright — osm-license
[15] https://wiki.openstreetmap.org/wiki/API_v0.6 — osm-api-docs
[16] https://ditjenbun.pertanian.go.id/regulasi/peraturan-menteri-pertanian — kementan-regulations
[17] https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html — soilgrids-access
[18] https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html — soilgrids-layers
[19] https://docs.isric.org/globaldata/soilgrids/wcs.html — soilgrids-wcs
[23] https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=121.8&latitude=-4.0&start=20200101&end=20200107&format=JSON — power-sample
[24] https://api.openstreetmap.org/api/0.6/map?bbox=121.59,-4.06,121.60,-4.05 — osm-sample
[27] https://storage.googleapis.com/water-world/downloads_ancillary/DataUsersGuidev2024_v.5.pdf — jrc-guide
[30] https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCapabilities — soilgrids-capabilities
[31] https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S04_00_E121_00_DEM/Copernicus_DSM_COG_10_S04_00_E121_00_DEM.tif — cop-dem-sample
[32] https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_S06E120_Map.tif — worldcover-sample
[34] https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=DescribeCoverage&COVERAGEID=phh2o_0-5cm_mean — soilgrids-describe
[36] https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/Aggregated/VER1-5/occurrence/occurrence_120E_0N_v1_5_2024.tif — jrc-occurrence-sample
[37] https://power.larc.nasa.gov/docs/faqs/data — power-data-faq
[38] https://dataonline.bmkg.go.id
[39] https://data.bmkg.go.id/tentang
[42] https://forum.earthdata.nasa.gov/viewtopic.php?t=505 — nasa-use-policy
[43] https://peraturan.bpk.go.id/Read/192280/Permentan%20Nomor%2048%20Tahun%202014.pdf — kementan-gap-bpk
[44] https://peraturan.bpk.go.id/Download/192280/Permentan%20Nomor%2048%20Tahun%202014.pdf — kementan-gap-pdf
[45] https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/global/cogs/chirps-v3.0.2020.01.cog — chirps3-sample
[46] https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=phh2o_0-5cm_mean&FORMAT=image/tiff&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326&SUBSET=long%28121.79,121.80%29&SUBSET=lat%28-4.01,-4.00%29 — soilgrids-subset-encoded
