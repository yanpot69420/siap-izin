# Rubrik indikatif kakao — rancangan untuk review

**Versi: usulan v0; belum disetujui, belum diimplementasikan.** Tanggal riset **25 Oktober 2026, WITA (UTC+08:00)**. Dokumen ini mengusulkan cara membaca bukti, bukan menyatakan kandidat lahan sudah tersedia atau cocok.

Rujukan kerja: [parameter pilot](../discovery/pilot-kakao.md), [keputusan](../decisions.md), dan [audit sumber serta uji akses](../discovery/data-sources.md). Ruang lingkup tetap `01273`, asumsi **budidaya kakao**, Kolaka Timur/Kolaka/Konawe/Konawe Selatan, target `5000m2` per kandidat. Perubahan scope atau keputusan penting diteruskan kepada pengguna melalui penanggung jawab project.

## 1. Prinsip yang tidak diubah rubrik

1. **Pisahkan kegiatan/zona, indikasi agronomi, dan preferensi.** Bukti pada satu sumbu tidak dapat menutupi kegagalan atau ketidaktahuan sumbu lain.
2. **Jalan hanya preferensi**, tanpa jarak maksimum sebagai syarat gugur. Dekat garis jalan tidak membuktikan akses fisik atau akses legal.
3. **Hak tanah, siap transaksi dan realisasi bukan prasyarat rekomendasi rencana.** Jangan memberi label “tanah tersedia”; kesiapan pengajuan resmi tetap pemeriksaan terpisah.
4. **Tidak ada kuota paksa per kabupaten.** Keluaran boleh tidak mempunyai kandidat pada kabupaten tertentu, atau belum mempunyai kandidat sama sekali, dengan alasan yang dapat ditelusuri.
5. **Tidak mengeluarkan S1/S2/S3/N, peluang izin, atau skor kesuburan semu.** Usulan pertama ialah profil kategoris beserta pembatas dan kualitas bukti. Skor berbobot numerik baru dibahas setelah sumber, ambang dan validasi disetujui.
6. **Target luas bukan klaim akurasi kondisi tanah.** Bidang `5000m2` lebih kecil daripada satu sel SoilGrids 250 m; DEM sekitar 30 m dan iklim grid juga tidak menjamin kondisi mikro bidang.[4][11][5]

## 2. Tiga keluaran terpisah

| Sumbu | Usulan status | Arti / larangan kompensasi |
|---|---|---|
| Kegiatan/zona | `memenuhi`, `bersyarat`, `tidak_memenuhi`, `belum_diketahui` | Hanya dari pemeriksaan aturan, versi, cakupan dan geometri resmi yang ditangani alur tata ruang. Metadata RDTR atau agronomi yang baik bukan pengganti pemeriksaan ini. |
| Profil agronomi | Status per variabel: `sejalan_referensi`, `perlu_telaah`, `indikasi_pembatas`, `belum_diketahui`; ringkasan menurut aturan di bawah | Kategori **indikatif pada skala data**, bukan kelas kesesuaian lahan formal. `sejalan_referensi` tidak berarti sudah memenuhi syarat tumbuh di lapangan. |
| Preferensi jalan | `jarak_terukur` atau `belum_diketahui`, ditambah metode dan kelas | Tidak ikut mengubah status zona/agronomi. Tidak memakai nilai kosong sebagai nol, tak hingga, atau hukuman tersembunyi. |

**Ringkasan agronomi usulan:**

- Bila ada variabel esensial belum diketahui, tampilkan **“bukti agronomi belum lengkap”**, sekalipun beberapa variabel sejalan referensi.
- Tampilkan semua indikasi pembatas bersama status kelengkapan; pembatas yang diketahui tidak boleh hilang karena variabel lain kosong.
- Jika bukti lengkap tetapi ada konflik referensi, ketidakpastian melintasi ambang, atau kondisi memerlukan pengelolaan, ringkas **“perlu telaah agronomi”**.
- Hanya setelah daftar variabel esensial, kecukupan bukti dan ambang disetujui reviewer, serta seluruh variabel lolos pembacaan itu, boleh tampil **“indikasi regional sejalan referensi yang dipilih”**. Tetap tidak menyebut “cocok lapangan”.

**Usulan daftar esensial untuk review:** iklim hujan dan suhu; medan/lereng; sifat serta kedalaman efektif tanah; drainase/genangan; dan kondisi tutupan. Daftar ini sengaja lebih luas daripada layer yang berhasil diakses. Maka audit sekarang **belum cukup** untuk ringkasan agronomi lengkap. Tutupan adalah konteks penggunaan dan risiko, bukan skor fisiologi tanaman.

## 3. Bukti numerik yang benar-benar dibaca, bukan ambang yang disetujui

Lembar FAO dan halaman ICCO telah dibaca; PDF Kementan dari JDIH BPK berhasil diunduh, tetapi isi hasil pindainya belum ditranskripsi/OCR. Angka berikut **tidak dinisbatkan kepada Kementan**.[1][3][44]

| Variabel | FAO Ecocrop, kode 2074 | ICCO Growing Cocoa | Implikasi review |
|---|---|---|---|
| Curah hujan tahunan | Optimal **1.200–3.000**, absolute **900–7.600** pada baris rainfall annual.[1] | Umumnya lebih disukai **1.500–2.000 mm/tahun**, tersebar baik; dry spells dengan hujan **<100 mm/bulan** tidak melebihi **tiga bulan**.[3] | Rentang optimum/preferensi berbeda; bukan bukti bahwa hujan di luar 2.000 langsung gagal. Rentang absolute FAO bukan target produksi. |
| Suhu | Baris persyaratan suhu: optimal **21–32**, absolute **10–38**.[1] | Rata-rata maksimum tahunan **30–32°C** dan rata-rata minimum **18–21°C**.[3] | Statistik berbeda. Jangan menerapkan batas maksimum/minimum ICCO pada suhu rata-rata harian/tahunan `T2M`. Lembar FAO tidak merinci statistik agregasi pada baris tersebut; verifikasi definisi sebelum membuat aturan suhu. |
| pH | Optimal **5–6,5**, absolute **4–8**.[1] | Dapat tumbuh pada **5,0–7,5**; menghindari keasaman berlebihan **≤4,0** dan alkalinitas **≥8,0**.[3] | “Optimal” dan “dapat tumbuh” tidak ekuivalen. Nilai di antara 6,5 dan 7,5 menuntut penjelasan, bukan label otomatis gagal. |
| Kedalaman / drainase | Optimal ditulis **deep (>>150 cm)**; absolute **medium (50–150 cm)**; drainase baik.[1] | Tanah yang mendukung akar hingga **1,5 m**, tanpa lapisan kedap di bawahnya; kelebihan air tidak menetap.[3] | Jangan menyederhanakan notasi `>>150` menjadi pengukuran tepat 150 cm. Profil SoilGrids sampai 200 cm tidak membuktikan kedalaman efektif atau tidak ada lapisan kedap.[18] |
| Elevasi | Batas atas absolute **900** pada baris altitude; optimum tidak diisi.[1] | Tidak dipakai sebagai ambang elevasi dari halaman yang dibaca. | Bukan batas gugur 900 m untuk Sulawesi Tenggara. Hubungan elevasi–iklim harus ditelaah bersama, bukan dihitung dua kali sebagai “bonus”. |
| Lereng | Tidak mengambil ambang lereng dari lembar ini. | Tidak mengambil ambang lereng dari halaman ini. | **Tidak mengarang** angka cutoff lereng. Tampilkan pengukuran dan minta reviewer menentukan aturan konservasi/operasional yang relevan. |

FAO adalah kompilasi parameter umum; ICCO adalah pedoman institusional untuk kakao, bukan validasi khusus empat kabupaten. Perbedaan di atas perlu diselesaikan bersama reviewer agronomi dan referensi Kementan yang telah benar-benar dibaca. Tidak memilih sumber berdasarkan mana yang menghasilkan kandidat paling banyak.

## 4. Usulan pencocokan referensi v0 — seluruhnya nonaktif sampai disetujui

Ini **usulan desain**, bukan standar agronomi resmi. Angka berasal dari referensi pada bagian 3; pemilihan rentang, status dan aturan batas adalah usulan project. Semua interval berikut inklusif pada kedua batas kecuali ditulis lain. Tanpa data yang sepadan statistiknya, hasil tetap `belum_diketahui`.

| ID | Usulan sinyal yang dapat diuji | Perlakuan di luar rentang / keterbatasan |
|---|---|---|
| AG-R01 Hujan | Bila rerata total tahunan pada periode yang disetujui berada di **1.500–2.000 mm/tahun**, beri `sejalan_referensi` untuk **jumlah hujan saja**; angka ini berada dalam kedua rentang yang dibaca.[1][3] | Di luar rentang itu: `perlu_telaah`, tampilkan apakah masih dalam optimal FAO 1.200–3.000. Jangan menetapkan gagal otomatis. Distribusi musim tetap kriteria terpisah. |
| AG-R02 Musim kering | Tampilkan profil bulanan, jumlah bulan <100 mm dan panjang rentetan bulan tersebut, menggunakan definisi/periode yang disetujui; sumber pembanding ICCO menyebut tiga bulan.[3] | **Belum usulkan lulus/gagal otomatis**: reviewer perlu menetapkan interpretasi dry spell, lintas pergantian tahun, dan apakah berbasis setiap tahun atau klimatologi. Rerata basah tidak boleh menghapus tahun kekeringan. |
| AG-T01 Suhu | Simpan `T2M`, `T2M_MIN` dan `T2M_MAX` jika tersedia, unit, periode dan agregasinya; tampilkan pembanding bagian 3 secara terpisah.[1][3] | **Belum ada cutoff suhu**. Sampel akses saat ini hanya menguji `T2M`, bukan minimum/maksimum.[23] Jangan memberi status sejalan hanya karena angka rerata terletak di antara ekstrem yang disukai. |
| AG-S01 pH | Usulkan **5,0–6,5** sebagai rentang pencocokan awal pH air. Uji per interval kedalaman yang disetujui, tidak hanya 0–5 cm.[1][3] | Di luar rentang: `perlu_telaah`, bukan resep pengapuran atau gagal. Bila Q0,05–Q0,95 melintasi batas, tampilkan ketidakpastian; jangan menyebut probabilitas kesesuaian dari satu nilai mean.[18] |
| AG-M01 Medan | Tampilkan elevasi serta distribusi lereng dalam persen: median, persentil tinggi dan maksimum beserta dukungan sel, buffer dan metode. | **Tidak ada cutoff elevasi/lereng yang diaktifkan.** DSM bukan DTM; nilai turunan memerlukan review. Jangan menilai risiko erosi hanya dari kemiringan.[11] |
| AG-S02 Tanah / akar | Sajikan fraksi tekstur, karbon organik dan CEC beserta kedalaman/ketidakpastian jika data tersedia; simpan kedalaman efektif, lapisan penghambat dan muka air sebagai temuan terpisah. | Tidak menetapkan angka nutrisi, tekstur, kedalaman atau drainase hanya dari sampel pH. Tidak mengonversi SOC menjadi bahan organik dengan faktor yang belum disetujui. |
| AG-W01 Air/genangan | Deteksi air yang didukung observasi menjadi **pemicu telaah**, bukan klasifikasi bahaya banjir. Validasi kode kelas/NoData per produk sebelum overlay.[27] | Nilai occurrence nol tidak cukup untuk “bebas genangan”; durasi banjir akar tetap unknown. Persentase occurrence bukan peluang banjir tahunan. Isu Monthly Recurrence JRC harus dicatat.[10] |
| AG-C01 Tutupan | Tampilkan proporsi kelas historis dan kebutuhan pemeriksaan kondisi terkini. Indikasi bangunan/air permanen memicu telaah sebelum membentuk polygon otomatis. | Tree cover/cropland bukan bukti budidaya kakao, tanah kosong atau boleh dibuka. Tidak menetapkan ambang persen tutupan atau larangan hukum dari WorldCover.[9] |

**Tidak ada nilai AG-R01/AG-S01 aktual yang dihitung untuk kandidat pada dokumen ini.** Tabel adalah spesifikasi yang bisa diuji setelah disetujui, bukan keluaran mesin rekomendasi.

## 5. Usulan prosedur pengukuran yang dapat diaudit

### 5.1 Sebelum menilai

- Simpan versi dataset, URL/query, tanggal retrieval, periode observasi, unit, CRS, resolusi native, nilai NoData, metode resampling dan pemrosesan. Bedakan metadata, unduhan parsial, raster lengkap, dan hasil analisis.
- Usulkan periode pembanding **1991–2020** untuk iklim, dengan dataset versi terkunci dan seluruh bulan tersedia. Ini **usulan periode project**, bukan klaim normal pilot sudah dihitung. Jika data kurang, jangan mengisi nol; laporkan celah dan jangan mengaktifkan sinyal yang bergantung padanya.
- Untuk hujan, jumlahkan nilai harian yang sah menjadi total bulanan/tahunan atau pakai produk bulanan yang didefinisikan sesuai. Jangan membandingkan `mm/day` langsung dengan `mm/tahun`. Sampel POWER menyatakan `PRECTOTCORR` dalam `mm/day`.[23]
- Untuk suhu, tetapkan statistik lebih dulu. Rata-rata ekstrem harian, ekstrem absolut dan rata-rata `T2M` bukan variabel yang saling menggantikan.

### 5.2 Statistik polygon

- **Usulan:** ukur luas geometri dengan metode metrik/geodesik yang terdokumentasi; jangan memakai luas derajat. `5000m2` ialah target per kandidat. Toleransi, singlepart/multipart dan metode pembentukan masih menunggu keputusan; jangan menerapkan toleransi tersembunyi.
- Ambil seluruh sel yang beririsan, hitung proporsi area valid dan pembobotan irisan bila relevan. Jangan hanya mengambil centroid dan menyatakan seluruh polygon seragam. Rekam jumlah sel unik sumber agar kandidat yang berbagi satu sel tidak tampak sebagai pengamatan tanah/iklim independen.
- Untuk kategori tutupan gunakan metode yang mempertahankan kelas, bukan interpolasi bilinear. Reproyeksi/resampling tidak menaikkan resolusi bukti.
- Lereng harus diturunkan dari DEM dengan CRS/unit horizontal dan vertikal yang benar, buffer tetangga, pilihan algoritma serta keluaran persen yang eksplisit. Derajat dan persen lereng tidak boleh tertukar. Uji pembacaan header saja belum membuktikan lereng dapat dihitung.
- SoilGrids menyimpan pH sebagai **pH × 10**; konversi sesuai dokumentasi. Sajikan kedalaman terpisah dan Q0,05/Q0,95 bersama prediksi. Jangan merata-ratakan ketidakpastian menjadi ukuran keyakinan buatan.[18]
- Jangan mengisi drainase/kedalaman efektif dari tidak adanya deteksi air JRC. Diperlukan bukti yang benar-benar menjawab kondisi tersebut, dengan metode dan tanggalnya.

### 5.3 Preferensi jalan tanpa cutoff

**Usulan awal:** jarak minimum geometris dari **batas polygon** ke garis jalan dalam satuan meter; bukan jarak dari centroid, bukan rute berkendara. Daftar kelas jalan, perlakuan track/path, akses privat dan tanggal snapshot harus disetujui sebelum digunakan. Sampel OSM memang berisi beberapa kelas, bukan hanya jalan kendaraan.[24]

Urutan tampilan yang diusulkan:

1. Pisahkan kelompok status kegiatan/zona; kelompok unknown/bersyarat tidak dilabeli memenuhi.
2. Di dalamnya tampilkan profil dan pembatas agronomi, **bukan** jumlah variabel hijau sebagai skor gabungan.
3. Kedekatan jalan boleh menjadi pembeda hanya pada kelompok yang bukti agronominya sebanding dan **seluruh anggotanya memiliki jarak terukur yang sebanding**. Bila ada jarak unknown, jangan diam-diam menaruhnya paling bawah; gunakan urutan ID stabil dan tampilkan atribut jarak tanpa pengurutan jalan untuk kelompok itu.
4. Tidak ada syarat `jarak <= X`, bobot jalan atau nilai nol untuk data kosong. Bobot/jarak transformasi belum diusulkan karena belum ada tujuan operasional yang divalidasi.

Bentuk urutan ini adalah pilihan desain untuk review, bukan keputusan pengguna. Kedekatan tidak pernah memperbaiki status zona maupun menghapus pembatas agronomi.

## 6. Rekaman keluaran minimum yang diusulkan

Untuk setiap kandidat nyata di masa depan, simpan:

- ID, kabupaten yang telah diverifikasi, geometri rencana, luas terukur, metode luas dan target `5000m2`.
- Status kegiatan/zona **terpisah** beserta rencana/versi/aturan/bukti dan cakupannya.
- Per kriteria: nilai mentah, unit, statistik waktu, kedalaman, resolusi native, kelas bukti, status, rule ID/versi, alasan, pembatas, proporsi area valid dan rujukan.
- Unknown reason yang spesifik: `not_downloaded`, `no_coverage`, `nodata`, `metric_mismatch`, `reference_conflict`, `insufficient_spatial_support`, `needs_field_evidence` atau `rule_not_approved`.
- Jarak jalan/metode/kelas dan ketidakpastian akses; hak/ketersediaan tanah sebagai **belum diperiksa**, bukan syarat gugur.
- Daftar tindak lanjut dan penanggung jawab review; larangan klaim cocok lapangan, jaminan izin/NIB atau status kepemilikan.

Usulan kelas bukti: **metadata saja → sampel akses → analisis regional → bukti lokal yang direview**. Ini tingkat pekerjaan, bukan angka probabilitas; keberhasilan unduhan tidak menaikkan bukti regional menjadi bukti lokal. Pada kondisi audit sekarang, tidak mengisi rekaman contoh dengan koordinat/nilai fiktif.

## 7. Skenario penerimaan untuk implementasi berikutnya

Daftar ini **belum dijalankan sebagai test aplikasi**, karena rubrik belum diimplementasikan.

| Kasus | Hasil yang wajib dipertahankan jika usulan diterima |
|---|---|
| Zona unknown, hujan sejalan referensi | Tidak menjadi kandidat final berlabel kegiatan/zona memenuhi. |
| Lereng/drainase unknown, jalan sangat dekat | Bukti agronomi tetap belum lengkap. |
| Jalan jauh tetapi bukti lain sama | Tidak gugur karena jarak; hanya preferensi yang berbeda. |
| Jalan tidak tersedia | Jarak null dengan alasan; bukan nol dan bukan gagal. |
| Nilai pH belum dibagi 10 | Validasi unit menahan evaluasi, bukan menghasilkan status palsu. |
| Rerata suhu dibanding ambang maksimum ICCO | Ditandai metric mismatch; tidak dievaluasi sebagai variabel sama. |
| CHIRPS/POWER hilang satu bulan dalam periode usulan | Tidak mengisi hujan nol; status yang bergantung pada periode lengkap ditahan. |
| pH/hujan tepat pada batas usulan | Interval inklusif diterapkan konsisten, dengan rule version dan presisi sumber. |
| Rentang ketidakpastian tanah melewati batas | Perlu telaah; mean tidak cukup untuk menyatakan tanpa pembatas. |
| Air occurrence nol / NoData | Dibedakan; keduanya tidak otomatis berarti bebas banjir/drainase baik. |
| Tutupan tree cover | Tidak menjadi bukti tanah kosong, kakao atau boleh dikonversi. |
| Empat polygon berada dalam satu sel tanah | Tampil dukungan sumber yang sama, bukan empat sampel tanah independen. |
| Satu kabupaten tidak memiliki bukti memadai | Tidak membuat kandidat semu demi kuota atau mengambil dari luar wilayah. |
| Luas mendekati target tetapi toleransi belum disetujui | Tidak melabeli memenuhi luas berdasarkan toleransi ciptaan implementer. |
| Tanah belum diketahui pemilik/ketersediaannya | Tidak menggugurkan rekomendasi rencana hanya karena hal tersebut; tidak mengklaim siap transaksi. |

## 8. Keputusan yang perlu diminta sebelum mengaktifkan rubrik

1. Konfirmasi scope budidaya; pilih reviewer agronomi dan referensi Kementan yang telah dibaca, bukan hanya indeks/PDF tersedia.
2. Setujui atau revisi daftar variabel esensial, tingkat bukti minimum dan apakah kandidat eksploratif dengan unknown boleh ditampilkan pada kelompok terpisah.
3. Putuskan apakah rentang pencocokan hujan/pH usulan diterima; selesaikan konflik referensi, definisi statistik suhu dan musim kering, serta aturan lereng/tanah/drainase yang masih kosong.
4. Setujui periode iklim, pemeriksaan kelengkapan, penanganan NoData, dan kebutuhan bukti lokal. Jangan mengaktifkan aturan dengan ambang belum disetujui.
5. Putuskan toleransi luas, singlepart/multipart, jumlah kandidat keseluruhan, kelas/metode jalan dan perilaku pengurutan unknown. **Tidak meminta ulang batas jarak maksimum jalan.**

Sampai keputusan itu dibuat, dokumen berfungsi sebagai bahan review dan rancangan pengujian, bukan otorisasi development atau hasil rekomendasi lapangan.

## Sources

[1] https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2074 — fao-ecocrop
[3] https://www.icco.org/growing-cocoa — icco-growing
[4] https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs.html — soilgrids-faq
[5] https://power.larc.nasa.gov/docs/tutorials/service-data-request/api — power-api-docs
[9] https://esa-worldcover.org/en/data-access — worldcover-access
[10] https://global-surface-water.appspot.com/download — jrc-download
[11] https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM — cop-dem-official
[18] https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html — soilgrids-layers
[23] https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=121.8&latitude=-4.0&start=20200101&end=20200107&format=JSON — power-sample
[24] https://api.openstreetmap.org/api/0.6/map?bbox=121.59,-4.06,121.60,-4.05 — osm-sample
[27] https://storage.googleapis.com/water-world/downloads_ancillary/DataUsersGuidev2024_v.5.pdf — jrc-guide
[44] https://peraturan.bpk.go.id/Download/192280/Permentan%20Nomor%2048%20Tahun%202014.pdf — kementan-gap-pdf
