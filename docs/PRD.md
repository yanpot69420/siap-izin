# PRD — Aplikasi Induk Asisten Perizinan Berusaha

**Versi:** 0.10 — eksplorasi lintas-rencana Sulawesi Tenggara; pemetaan exact-KBLI belum direview, cakupan mengikuti sumber yang benar-benar tersedia

**Pemilik kebutuhan:** Anton

**Nama kerja repositori:** Siap Izin; nama produk/merek final belum diputuskan

**Bentuk produk:** usulan aplikasi web internal dengan modul terintegrasi

**Cakupan visi:** dokumen perusahaan → KBLI → pemeriksaan lokasi/RDTR → polygon → persiapan dan penginputan OSS → tindak lanjut perizinan.

> Dokumen ini adalah rancangan produk, bukan pendapat hukum atau bukti bahwa suatu kegiatan/lokasi telah disetujui pemerintah. Seluruh target, peran tambahan, dan pembagian fase yang belum dikonfirmasi Anton berstatus usulan. Prototipe eksplorasi satu rencana sudah diimplementasikan dan diuji; bukan mesin produksi. Tidak ada pengujian akun OSS atau validasi berkas klien yang telah dilakukan.

## 1. Ringkasan produk

Aplikasi mengelola satu berkas kerja perizinan dari dokumen awal sampai hasil resmi dan tindak lanjut. Sistem menyatukan data perusahaan, kegiatan, lokasi, batas lahan, pemeriksaan, keputusan reviewer, dan bukti keluaran dalam satu tempat.

AI bertugas mengekstrak, menyarankan, dan menjelaskan. Mesin aturan serta GIS memvalidasi hal yang dapat diuji secara deterministik. Operator/reviewer memeriksa data dan memberikan persetujuan sebelum tindakan berkonsekuensi eksternal.

**Prinsip utama:** sistem boleh mengusulkan lokasi dan geometri rencana dari data nyata serta kriteria pengguna, tetapi tidak mengarang bukti, kondisi aktual, kepemilikan atau persetujuan. Kandidat rencana bukan batas bidang terukur, jaminan ketersediaan tanah atau persetujuan resmi. Tidak menganggap berhasil mengisi formulir sama dengan berhasil memperoleh izin.

Usulan terbaru Anton: pemeriksaan dan pencarian lokasi diawali dari peta Sulawesi Tenggara; pengguna memfilter KBLI dan melihat sorotan zona yang relevan. Detail status, pemetaan aturan, dan prioritas pilot di bawah adalah rancangan yang masih perlu disepakati. Inventaris awal metadata untuk empat kabupaten pilot sudah dilakukan dan dicatat pada bagian 8.7; cakupan geometri, ketentuan per bidang dan kelayakan data belum diverifikasi menyeluruh.

Koreksi lingkup dari Anton: tujuan modul lokasi adalah membantu penyusunan rencana lokasi/polygon untuk kegiatan yang diajukan, bukan memastikan tanah tersedia atau proyek telah direalisasikan. Sistem dapat mencari dan membentuk kandidat berdasarkan KBLI, luas, kondisi tutupan yang diinginkan, kedekatan jalan dan kriteria tambahan yang disetujui. Luas 5000m2 kini dipilih sebagai target kasus pilot kakao; bukan standar luas semua kegiatan atau seluruh proyek aplikasi. Pernyataan ini mendefinisikan produk; persyaratan pengajuan resmi tetap perlu diverifikasi terpisah.

## 2. Masalah yang hendak diselesaikan

Hipotesis berikut perlu diperiksa melalui contoh berkas dan wawancara pengguna:

- Data perusahaan diketik ulang pada beberapa tahap.
- Dokumen pendirian dan perubahan berpotensi tidak sinkron.
- Pemilihan KBLI, pemeriksaan lokasi, dan pengolahan polygon dilakukan terpisah.
- Dasar suatu rekomendasi sulit dilacak kembali.
- Perubahan KBLI atau lokasi tidak selalu diikuti pemeriksaan ulang seluruh hasil yang bergantung padanya.
- Tindak lanjut dan dokumen hasil tersebar di folder, percakapan, serta akun eksternal.

Belum tersedia baseline waktu kerja, frekuensi kesalahan, volume berkas, dan biaya proses saat ini.

## 3. Status keputusan dan asumsi

| ID | Pernyataan | Status |
|---|---|---|
| D-01 | Lingkup visi mencakup pemeriksaan akta, KBLI, RDTR, polygon, OSS, NIB dan tindak lanjut Sertifikat Standar bila relevan | Disampaikan Anton |
| D-02 | Pekerjaan dikelola dalam satu aplikasi induk | Rekomendasi yang telah dibahas; perlu persetujuan final |
| D-03 | Antarmuka berupa aplikasi web | Rekomendasi yang telah dibahas; perlu persetujuan final |
| D-04 | Peta awal Sulawesi Tenggara dengan filter KBLI dan sorotan zona pendukung | Usulan eksplisit Anton; rincian penerapan belum disetujui |
| D-05 | Sistem merekomendasikan lokasi/polygon rencana berdasarkan kriteria; ketersediaan dan realisasi tanah bukan tujuan utama atau prasyarat mesin rekomendasi | Ditegaskan Anton; tidak diubah menjadi kesimpulan syarat hukum/OSS |
| D-06 | Contoh awal: pertanian, luas 5000 m2, tanah kosong/perhutanan dan dekat jalan | Historis; kode/wilayah/luas pilot diperjelas D-07, jalan diputuskan D-08; arti tutupan dan toleransi masih terbuka |
| D-07 | Pilot: KBLI 01273; Kolaka Timur, Kolaka, Konawe, Konawe Selatan; target 5000m2; cocok untuk kakao; kandidat di peta dan berkas polygon | Dipilih Anton; parameter detail dan gerbang data masih terbuka |
| D-08 | Kedekatan jalan hanya preferensi pemeringkatan pada pilot; tidak ada batas maksimum jarak sebagai syarat gugur | Ditetapkan Anton; metode, kelas jalan dan bobot masih perlu ditinjau |
| D-09 | Tahapan proyek boleh dilanjutkan; pertanyaan penting dikonfirmasi kepada Anton | Disampaikan setelah commit awal; audit/rancangan/mockup dapat dilanjutkan, bukan izin pengajuan OSS atau layanan berbayar |
| D-10 | Format keluaran SHP ZIP disertai KML | Dikonfirmasi melalui formulir; atribut dan penerimaan target belum diuji |
| D-11 | Modul eksplorasi hanya untuk melihat zona berdasarkan KBLI terpilih; input luas dihapus | Ditegaskan Anton; kriteria eksplorasi KBLI/wilayah, parameter kandidat berada pada modul terpisah |
| D-12 | Filter eksplorasi mencakup seluruh kabupaten/kota Sulawesi Tenggara | Diminta Anton; 17 pilihan tersedia. Tidak dianggap mengaktifkan seluruh geometri atau mengubah pilot kandidat empat kabupaten |
| D-13 | Lanjutkan eksplorasi 01273 ke semua sumber Sulawesi Tenggara yang tersedia | Diminta Anton. Registry 18 rencana/17 wilayah, 16 calon relasi dan 2 unknown; bukan jaminan seluruh daratan atau izin |
| A-01 | Penggunaan awal untuk Anton dan tim internal, bukan SaaS publik | Asumsi |
| A-02 | Ada pemeriksaan manusia sebelum data final dan pengajuan | Usulan pengamanan |
| A-03 | MVP berakhir pada paket siap input dan pencatatan hasil input manual | Usulan batas MVP |
| A-04 | Ada dua asal geometri: batas yang diberikan pengguna dan polygon rencana yang dihasilkan sistem dari kriteria. Ketersediaan/hak tanah tidak menjadi prasyarat menghasilkan kandidat; jenis dan sumber geometri wajib dibedakan | Dikoreksi sesuai penjelasan Anton; gerbang pengajuan terpisah |
| A-05 | Otomasi browser OSS dilaksanakan setelah kelayakan dan ketentuan penggunaannya diperiksa | Usulan gerbang integrasi |
| A-06 | Tidak semua proyek harus memiliki keluaran akhir yang sama | Prinsip desain; percabangan operasional perlu validasi ahli |

## 4. Tujuan dan bukan tujuan

### Tujuan

1. Mengurangi penginputan ulang dan ketidakkonsistenan antartahap.
2. Menyediakan rekomendasi yang dapat ditelusuri ke dokumen dan sumber pemeriksaan.
3. Menemukan kekurangan sebelum pengajuan ke sistem eksternal.
4. Menyimpan status, tanggung jawab, dan riwayat proyek.
5. Menyiapkan data yang benar dan terstruktur untuk penginputan OSS.
6. Menambahkan otomasi eksternal secara bertahap tanpa kehilangan kontrol pengguna.
7. Membantu eksplorasi zona kandidat melalui peta Sulawesi Tenggara dengan filter KBLI, tanpa menganggap hasil sorotan sebagai kepastian izin atau ketersediaan tanah.
8. Mengusulkan beberapa lokasi dan membentuk polygon rencana sesuai luas serta kriteria pengguna, dengan alasan pemeringkatan, ukuran yang dihitung dan ketidakpastian yang terlihat.

### Bukan tujuan MVP

- Menjamin penerbitan NIB, Sertifikat Standar, KKPR, atau izin lain.
- Menggantikan keputusan pejabat atau verifikasi substantif.
- Mengubah akta, mengurus perubahan badan hukum, atau menerbitkan dokumen legal.
- Mengotomatiskan pembayaran, tanda tangan, atau pernyataan pemenuhan persyaratan.
- Menembus CAPTCHA, menghindari OTP, atau melewati kontrol akses.
- Memastikan tanah dapat dibeli/disewa, membuktikan hak atas tanah, atau memastikan proyek telah direalisasikan. Informasi ini bukan prasyarat keluarnya kandidat rencana.
- Mengklaim polygon rencana hasil sistem sebagai batas kepemilikan/hasil ukur, kondisi lapangan terverifikasi atau lokasi yang telah disetujui. Pembuatan polygon rencana berdasarkan kriteria justru termasuk tujuan produk.
- Mengarang bukti atau mengubah fakta untuk memaksakan kesimpulan sesuai; mengusulkan lokasi alternatif yang benar-benar memenuhi kriteria tidak termasuk larangan ini.
- Mencakup seluruh sektor, bentuk usaha, wilayah, dan skenario pada rilis pertama.
- Menghitung seluruh kewajiban sektoral secara otomatis sebelum aturan serta cakupannya divalidasi.

## 5. Pengguna dan hak akses

Peran berikut merupakan usulan. Satu orang boleh memegang beberapa peran jika disetujui, tetapi sistem harus mencatat identitas setiap tindakan.

| Peran | Tanggung jawab | Batas akses |
|---|---|---|
| Operator | Membuat proyek, mengunggah dokumen, mengoreksi ekstraksi, menyiapkan data | Tidak mengirim pengajuan tanpa otorisasi yang sesuai |
| Reviewer/penanggung jawab | Memeriksa kegiatan, KBLI, lokasi, batas dan kelengkapan; menyetujui paket final | Persetujuan terkait versi data tertentu |
| Admin | Mengelola pengguna, akses, konfigurasi dan katalog | Tidak otomatis menyetujui substansi proyek |
| Klien/pemohon | Memberi dokumen atau klarifikasi | Portal klien di luar MVP; akses tidak diasumsikan |

Pemisahan operator dan reviewer wajib atau opsional merupakan keputusan terbuka.

## 6. Unit kerja dan model informasi

**Perusahaan tidak sama dengan proyek, dan proyek tidak sama dengan satu KBLI.**

Usulan model:

- **Organisasi pengguna:** batas kepemilikan data internal; MVP satu organisasi.
- **Perusahaan/pelaku usaha:** identitas dan kumpulan dokumen; jenis pelaku usaha yang didukung perlu dipilih.
- **Dokumen:** berkas asli, jenis, versi, tanggal dokumen jika diketahui, dan tautan hasil ekstraksi.
- **Proyek:** satu berkas kerja operasional. Definisi awal satu perusahaan dan satu lokasi, dengan beberapa kegiatan; harus divalidasi terhadap cara kerja Anton dan representasi proyek OSS.
- **Kegiatan usaha:** uraian aktual, kandidat dan pilihan KBLI, versi klasifikasi, ruang lingkup, serta jawaban klarifikasi.
- **Lokasi:** alamat jika diketahui, koordinat, sumber, geometri, CRS, luas deklarasi dan luas hitung; jenis `Batas diberikan` atau `Polygon rencana sistem`; tidak mengarang alamat atau hak tanah.
- **Skenario pencarian:** KBLI/versi/ruang lingkup, wilayah, luas target, toleransi, kriteria wajib/preferensi, ambang, bobot yang disetujui, dan kebijakan menangani data tidak diketahui.
- **Kandidat rencana:** polygon usulan, versi input/dataset/metode, hasil tiap kriteria, luas hitung, peringkat beserta alasan, keterbatasan dan pilihan reviewer. Persetujuan kandidat tidak mengubah asalnya menjadi bidang kadaster.
- **RDTR dan subzona:** identitas wilayah/rencana/subzona/blok bila ada, geometri, sumber dan versi; kode zona yang sama pada rencana berbeda tidak disamakan otomatis.
- **Pemetaan kegiatan:** relasi KBLI beserta versi/ruang lingkup ke kegiatan lokal dan ketentuan spesifik rencana; dasar, reviewer dan status verifikasinya disimpan.
- **Snapshot pencarian peta:** pilihan KBLI, mode filter, versi data, zona kandidat dan batas kepastian; tidak otomatis menjadi lokasi resmi proyek.
- **Pemeriksaan:** input versi tertentu, sumber, waktu pemeriksaan, temuan, status dan bukti.
- **Persetujuan:** identitas pemberi, waktu, ruang lingkup, versi input dan keputusan.
- **Tugas:** penanggung jawab, status, tenggat jika diberikan pengguna, alasan tertunda.
- **Pengajuan/hasil eksternal:** jenis, ID resmi jika tersedia, status yang diamati, bukti, tanggal pengamatan dan dokumen hasil.
- **Pekerjaan otomasi:** ID tugas, tahapan, percobaan, hasil, kesalahan dan status efek eksternal.

Satu perusahaan dapat mempunyai beberapa proyek. Duplikasi proyek harus membuat ID baru dan mengosongkan bukti pengajuan/persetujuan yang tidak berlaku; tidak menyalin seolah-olah telah disetujui.

## 7. Alur utama dan gerbang persetujuan

### 7.1 Tahap proses

1. Operator membuat perusahaan dan proyek.
2. Operator memilih jenis kasus serta mengunggah dokumen sumber.
3. Sistem mengekstrak data dan menandai nilai yang tidak terbaca, bertentangan atau belum terisi.
4. Operator mengoreksi; reviewer mengonfirmasi profil perusahaan yang akan digunakan.
5. Operator menjelaskan kegiatan usaha nyata; sistem menyusun kandidat KBLI.
6. Reviewer mengonfirmasi kode, versi, uraian dan ruang lingkup.
7. Operator membuka peta Sulawesi Tenggara dan memilih KBLI beserta kriteria pencarian, atau memasukkan batas yang sudah ada. Sistem dapat mengusulkan beberapa lokasi dan polygon rencana; pengguna memilih kandidat tanpa perlu membuktikan tanah tersedia untuk tahap rekomendasi.
8. Sistem menjalankan pemeriksaan tata ruang yang tersedia, atau membuat tugas pemeriksaan manual dengan bukti.
9. Sistem memvalidasi geometri yang diberikan atau membentuk polygon rencana sesuai luas target, menguji seluruh bidang terhadap kriteria dan menyiapkan ekspor berlabel sesuai asalnya.
10. Reviewer menyetujui kandidat/batas untuk tujuan yang dinyatakan. Sistem memisahkan persetujuan rencana dari kesiapan pengajuan resmi dan menjalankan pemeriksaan konsistensi akhir; persyaratan pengajuan tidak disimpulkan dari skor rekomendasi.
11. Sistem menghasilkan paket siap input yang terikat pada versi data yang disetujui.
12. MVP: operator melakukan penginputan eksternal dan mencatat bukti hasil. Fase berikutnya: worker membantu penginputan sesuai batas otorisasi.
13. Proyek berlanjut pada persyaratan dan hasil yang relevan, termasuk klarifikasi atau perbaikan bila ada.
14. Reviewer menutup atau membatalkan proyek dengan alasan dan bukti yang sesuai.

### 7.2 Status proses internal

`Draf → Menunggu dokumen → Ditinjau → Perlu klarifikasi → Siap pemeriksaan lokasi → Pemeriksaan lokasi → Siap tinjauan akhir → Siap input → Dalam proses eksternal → Tindak lanjut → Selesai`

Status tambahan: `Ditahan`, `Dibatalkan`, `Kesalahan teknis`. Status dapat kembali ke tahap sebelumnya melalui transisi yang tercatat.

**Status internal berbeda dari status resmi.** “Siap input” bukan “NIB terbit”; “hasil diunduh” bukan bukti semua persyaratan terpenuhi. Status resmi disimpan apa adanya bersama sumber/bukti dan waktu observasinya. Proyek tidak otomatis “Selesai” karena NIB tersedia jika masih ada tindak lanjut dalam lingkup pekerjaan.

### 7.3 Pembatalan persetujuan akibat perubahan

| Perubahan | Hasil yang wajib ditinjau kembali |
|---|---|
| Dokumen perusahaan atau identitas kunci | Profil perusahaan, paket final dan bagian lain yang bergantung pada perubahan |
| Kegiatan, ruang lingkup, KBLI atau versinya | Pemeriksaan kegiatan/RDTR terkait, daftar persyaratan dan paket final |
| Lokasi, koordinat atau geometri | Overlay, luas, berkas polygon dan paket final |
| Sumber aturan atau katalog | Temuan terkait ditandai perlu evaluasi dampak; hasil historis tidak ditimpa |

Sistem mempertahankan hasil lama sebagai riwayat dan menandai hasil turunannya `Perlu ditinjau ulang`.

## 8. Kebutuhan fungsional MVP

**P0:** wajib untuk pilot terbatas. **P1:** setelah P0 stabil. **P2:** cakupan lanjutan, bukan janji rilis.

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| F-01 | P0 | Login dan pembatasan akses | Pengguna tanpa akses tidak dapat melihat, mengekspor atau mengubah proyek melalui UI maupun API |
| F-02 | P0 | Perusahaan dan proyek | Satu perusahaan dapat memiliki beberapa proyek; identitas dan status tidak tertukar |
| F-03 | P0 | Unggah dan versi dokumen | Asli dipertahankan; tipe/ukuran diperiksa; penggantian membuat versi baru, bukan menimpa diam-diam |
| F-04 | P0 | Ekstraksi dokumen | Setiap nilai penting memiliki sumber halaman/area dokumen, atau diberi label input manual; nilai tidak terbaca menjadi kosong/temuan, bukan tebakan |
| F-05 | P0 | Pemeriksaan konflik | Perbedaan nama, nomor, alamat atau informasi kunci antardokumen tampil sebagai temuan; pemilihan dokumen berlaku membutuhkan konfirmasi |
| F-06 | P0 | Kandidat KBLI | Saran menyertakan alasan, versi dan rujukan katalog; kegiatan yang ambigu menghasilkan pertanyaan; pilihan final tidak otomatis |
| F-07 | P0 | Katalog berversi | Kode dokumen sumber dan kode target dipisahkan; pemetaan yang tidak tunggal tidak diputuskan otomatis |
| F-08 | P0 | Input lokasi dan peta | Mendukung sumber lokasi/batas yang dipilih untuk pilot; perubahan geometri membuat versi baru |
| F-09 | P0 | Pemeriksaan RDTR terbatas | Dalam cakupan pilot, hasil mencatat sumber, kegiatan yang dicek, cakupan geometri dan bukti; bila akses otomatis tidak tersedia, pemeriksaan manual tetap terstruktur |
| F-10 | P0 | Validasi dan ekspor polygon | Geometri, CRS, fitur, luas dan atribut diperiksa; ekspor dibaca ulang; format dan skema mengikuti hasil validasi kebutuhan target |
| F-11 | P0 | Checklist dan persetujuan | Temuan penghambat mencegah status siap input; persetujuan menyimpan pemberi dan versi input |
| F-12 | P0 | Paket siap input | Paket berisi data terstruktur, ringkasan, berkas relevan, checklist dan manifest versi; format final paket dipilih saat desain |
| F-13 | P0 | Catatan hasil eksternal | Operator dapat mencatat ID/status, mengunggah dokumen hasil dan bukti; sumber manual dibedakan dari pembacaan langsung sistem |
| F-14 | P0 | Tindak lanjut | Persyaratan memiliki pemilik dan status; tenggat tidak diciptakan bila belum diketahui |
| F-15 | P0 | Jejak audit | Perubahan nilai penting, persetujuan, ekspor, pengiriman dan penutupan dapat ditelusuri |
| F-16 | P0 | Lanjut setelah gagal | Kegagalan pekerjaan tidak menghapus hasil terverifikasi; percobaan ulang tercatat dan tidak menggandakan efek eksternal |
| F-17 | P1 | Bantuan pengisian OSS | Hanya skenario pilot yang diuji; berhenti pada autentikasi/tantangan atau halaman tidak dikenali; tidak menekan kirim akhir tanpa otorisasi |
| F-18 | P1 | Pemantauan terjadwal | Status berubah hanya berdasarkan pembacaan/bukti aktual; kegagalan akses bukan perubahan status perizinan |
| F-19 | P1 | Notifikasi | Pengguna menerima pengingat tugas/klarifikasi sesuai preferensi yang disetujui |
| F-20 | P0 usulan | Peta eksplorasi KBLI Sulawesi Tenggara | Hanya kriteria KBLI dan wilayah; tidak meminta luas atau parameter kandidat. Filter menyorot zona berbukti dengan legenda status; area tanpa data tetap unknown |
| F-21 | P0 usulan | Detail zona | Klik zona menampilkan RDTR/subzona, kegiatan yang dicocokkan, status, syarat, dasar pemetaan, versi dan sumber |
| F-22 | P0 usulan | Pemetaan KBLI ke ketentuan | Hanya pemetaan yang ditinjau masuk hasil terverifikasi; dugaan AI/kemiripan istilah tampil terpisah sebagai belum terverifikasi |
| F-23 | P0 usulan | Cakupan dan mutu data | Bedakan belum tercakup, aturan belum tersedia, pemetaan belum terverifikasi, konflik dan data kedaluwarsa; tidak disatukan sebagai tidak sesuai |
| F-24 | P0 usulan | Peta ke proyek dan ekspor rencana | Kandidat dapat dibentuk/diekspor tanpa bukti ketersediaan tanah; asal geometri dan label rencana wajib, pemeriksaan seluruh geometri dijalankan; pemakaian untuk pengajuan memiliki gerbang review terpisah |
| F-25 | P1 usulan | Filter beberapa KBLI | Mode semua/salah satu eksplisit, hasil per KBLI tetap terlihat dan kondisi tidak dihilangkan oleh agregasi |
| F-26 | P0 usulan | Publikasi dan pembaruan data peta | Dataset dan pemetaan diperiksa sebelum tayang; perubahan versi menandai kandidat/pemeriksaan terdampak untuk review tanpa menimpa bukti historis |
| F-27 | P0 usulan | Formulir kriteria rencana | Pada modul pencarian/pembuatan polygon terpisah, pengguna memasukkan KBLI, luas, toleransi dan kriteria tambahan; bukan formulir wajib eksplorasi zona |
| F-28 | P0 usulan | Pembentukan polygon rencana | Geometri dibentuk pada koordinat nyata, valid dan memenuhi luas dalam toleransi yang disetujui; seluruh bidang diuji, bukan titik pusat; hasil ditandai rencana |
| F-29 | P0 usulan | Beberapa kandidat dan alasan | Jumlah kandidat dipilih pada discovery; hasil dibandingkan per kriteria dan peringkat dapat dijelaskan, tanpa persentase peluang izin yang tidak diukur |
| F-30 | P0 usulan | Kriteria wajib vs preferensi | Pelanggaran kriteria wajib tidak ditutup skor preferensi; sistem tidak melonggarkan ambang tanpa konfirmasi dan dapat mengembalikan tidak ada hasil |
| F-31 | P0 usulan | Preferensi kedekatan jalan | Pada pilot, jarak hanya mempengaruhi peringkat dan tidak menggugurkan kandidat yang memenuhi kriteria wajib; metode/endpoints ditampilkan; data jalan hilang berstatus unknown, bukan jarak nol; bukan bukti akses legal atau dapat dilalui |
| F-32 | P0 usulan | Tutupan dan status area terpisah | Sumber/waktu tutupan dicatat; status kawasan ditampilkan terpisah; kosong/bervegetasi/perhutanan tidak otomatis menjadi klaim hak atau izin |
| F-33 | P0 usulan | Asal dan ketidakpastian kandidat | Tidak ada data ketersediaan/hak bukan alasan menolak rekomendasi; tidak ada data untuk kriteria wajib menghasilkan belum dapat dipastikan, bukan lulus |
| F-34 | P0 usulan | Persetujuan kriteria tambahan | Saran sistem seperti kemiringan/risiko banjir ditampilkan untuk disetujui; tidak diam-diam menjadi syarat wajib atau mengubah luas/KBLI |
| F-35 | P0 usulan | Evaluasi kakao dua dimensi | Pilot 01273 menampilkan status kegiatan/zona terpisah dari indikasi agronomi; tidak menyimpulkan cocok tumbuh dari zona saja |
| F-36 | P0 usulan | Skala bukti dan kelengkapan pilot | Hasil mencatat resolusi/cakupan dataset dan batas analisis 5000m2; keempat kabupaten diperiksa, tetapi hasil kosong/unknown diperbolehkan jika bukti tidak memadai |
| F-37 | P0 usulan | Karantina mutu geometri sumber | Fitur sumber invalid tidak masuk pembentukan kandidat secara diam-diam; asli dipertahankan, alasan tercatat, setiap perbaikan turunan perlu pemeriksaan luas/topologi |
| F-38 | P0 eksplorasi diminta | Inventaris lintas-rencana dan celah wilayah | Snapshot katalog direkonsiliasi dengan 17 wilayah; timestamp/status snapshot eksplisit. Tidak tercantum atau aktivitas null tetap unknown, bukan dilarang |
| F-39 | P0 eksplorasi diminta | Sorotan semua rencana terpilih | Maksimal 3 request serentak; filter/aktivitas/CRS/cache per rencana. Identitas pasangan planId/OID; status parsial, pending, gagal dan karantina terlihat tanpa menghilangkan hasil sah |
| F-40 | P0 eksplorasi diminta | Ekspor lintas-rencana | Skema 3 berisi wilayah/namespace, snapshot katalog serta provenance/counts aktual per rencana. Pratinjau sama dengan unduhan; tanpa geometri/luas/jalan/kandidat atau keputusan OSS |

### 8.1 Ketentuan dokumen dan AI

- Daftar dokumen wajib dibuat per skenario, bukan satu daftar universal.
- Jenis file dan batas ukuran final dipilih setelah sampel diterima; PDF menjadi usulan format awal, scan/gambar masuk bila diperlukan pilot.
- Penggabungan pendirian dan perubahan tidak dilakukan hanya berdasarkan tanggal unggah.
- Pengguna dapat membandingkan hasil ekstraksi dengan dokumen sumber.
- Kolom kritis untuk persetujuan final ditentukan bersama Anton; usulan: identitas pelaku usaha, KBLI/versi, lokasi, geometri dan data pengajuan utama.
- Model AI tidak boleh menambahkan fakta tanpa sumber, mengirim tindakan, atau mengubah status resmi sendiri.
- Confidence jika dipakai adalah sinyal pemeriksaan, bukan jaminan kebenaran atau pengganti sumber.
- Isi dokumen/web diperlakukan sebagai data tidak tepercaya; instruksi di dalamnya tidak boleh menjalankan alat, membuka akses atau melewati persetujuan.
- Semua koreksi pengguna mempertahankan nilai ekstraksi awal dan alasan koreksi bila relevan.

### 8.2 Ketentuan KBLI dan referensi regulasi

PP Nomor 28 Tahun 2025 tercatat pada JDIH BKPM sebagai peraturan mengenai penyelenggaraan perizinan berusaha berbasis risiko.[1] Dokumen ini belum memetakan seluruh ketentuan sektoral atau skenario penerapannya.

BPS telah menerbitkan tabel konversi KBLI 2020–2025; karena terdapat perubahan pengelompokan dan rincian klasifikasi, data harus menyimpan versi, bukan kode saja.[2] Halaman konversi OSS yang dibaca menampilkan label KBLI 2020 dan KBLI 2025, tetapi pembacaan halaman tersebut belum membuktikan versi operasional setiap alur pengajuan.[5]

Persyaratan produk:

- Verifikasi katalog dan versi target pada sistem tujuan sebelum implementasi serta sebelum pergantian versi.
- Simpan `kode_asli`, `versi_asli`, `kode_target`, `versi_target`, dasar konversi, serta keputusan reviewer.
- Pisahkan katalog BPS, persyaratan perizinan dan pemetaan kegiatan RDTR.
- Tidak menyamakan ID kegiatan pada layanan peta dengan kode KBLI tanpa dasar pemetaan.
- Katalog/aturan dapat diperbarui melalui proses admin dan review, dengan tanggal berlaku serta sumber; tidak cukup ditulis permanen dalam prompt.
- Ketiadaan aturan yang terverifikasi menghasilkan status belum dapat diputuskan, bukan bebas persyaratan.

### 8.3 Ketentuan RDTR dan polygon

OSS menyediakan panduan persyaratan dasar tata ruang untuk KKPR darat pada RDTR.[3] Panduan tersebut dipakai sebagai referensi awal; urutan langkah, kebutuhan polygon dan persyaratan pada antarmuka live tetap harus diperiksa saat discovery, bukan dianggap sudah tervalidasi.

Persyaratan produk:

- Bedakan lokasi yang sudah tetap dan kebutuhan pencarian kandidat lokasi.
- Revisi v0.3 memasukkan rekomendasi lokasi dan polygon rencana berbasis kriteria. Pencarian tanah siap transaksi atau pembuktian hak bukan tujuan dan bukan prasyarat rekomendasi. Lokasi tetap tetap dapat diperiksa tanpa alur pencarian.
- Simpan bukti dan sumber data; periksa apakah pemakaian dan akses ulang diizinkan sebelum integrasi.
- Overlay seluruh polygon yang diberikan, bukan hanya satu titik pusat, apabila data resmi memungkinkan.
- Laporkan setiap zona yang beririsan, bagian yang belum tercakup dan kemungkinan tumpang tindih.
- Bedakan hasil kesesuaian spasial, ketentuan kegiatan, kecocokan KBLI spesifik, dan hasil resmi OSS.
- Bila bukti belum cukup, gunakan `Belum dapat dipastikan`, bukan `Sesuai`.
- Batas yang diberikan pengguna tidak digeser atau diubah tanpa persetujuan. Untuk mode rencana, sistem justru boleh membentuk dan menyesuaikan geometri usulan sesuai kriteria yang disetujui, dengan versi, metode dan asal yang jelas.
- Luas deklarasi dan luas hasil hitung disimpan terpisah; metode luas serta CRS dicatat.
- Perbedaan alamat dan koordinat menjadi temuan yang harus diselesaikan.
- Untuk konversi, ekspor mempertahankan sumber asli dan menghasilkan turunan beridentitas versi. Untuk polygon baru, simpan parameter dan geometri usulan sebagai sumber hasil; jangan menciptakan dokumen bidang tanah pendukung yang tidak ada.
- Lolos uji lokal tidak ditampilkan sebagai lolos unggah/validasi OSS.
- Format unggah, tipe atribut, jumlah fitur dan batas ukuran wajib diuji pada target pilot sebelum dibekukan sebagai kontrak ekspor.

### 8.4 Ketentuan penginputan eksternal

- MVP tidak memerlukan penyimpanan kata sandi OSS.
- Tindakan eksternal berhak akses hanya dilakukan pada akun yang diotorisasi.
- Sebelum bantuan pengisian dirilis, verifikasi aturan penggunaan, mekanisme autentikasi dan kelayakan integrasi.
- API resmi yang tersedia dan diizinkan diprioritaskan setelah benar-benar ditemukan; ketersediaannya tidak diasumsikan.
- Login/OTP/CAPTCHA diselesaikan pengguna melalui alur aman; tidak dilewati atau dicatat ke log.
- Sesi harus dipisah per akun dan proyek yang sedang dikerjakan.
- Sebelum pengiriman, tampilkan ringkasan data serta konsekuensi tindakan untuk persetujuan eksplisit.
- Bila terjadi timeout setelah klik kirim, tandai efek `Tidak diketahui` dan periksa target sebelum mengulang.
- Pengajuan baru tidak otomatis dilakukan sebagai respons kesalahan.
- ID resmi, halaman hasil atau berkas keluaran dibaca kembali sebelum klaim keberhasilan.
- Tidak ada pembayaran, tanda tangan atau pernyataan pemenuhan yang diotomasi pada cakupan awal.

### 8.5 Peta Eksplorasi KBLI Sulawesi Tenggara — usulan revisi

**Tujuan modul eksplorasi:** melihat zona yang sesuai/relevan berdasarkan KBLI yang dipilih dan batas wilayah opsional. Tidak ada input luas, preferensi jalan, penilaian agronomi atau pembentukan kandidat pada modul ini. Pencarian/pembuatan polygon rencana dan pemeriksaan batas existing tetap bagian visi aplikasi, tetapi dijalankan pada modul terpisah. Target 5000m2 tetap parameter pilot polygon, bukan prasyarat eksplorasi atau nilai tersembunyi dalam ekspornya.

**Peta provinsi bukan klaim cakupan RDTR provinsi lengkap.** Seluruh Sulawesi Tenggara dapat menjadi area tampilan awal, tetapi hanya bagian yang sumber geometri dan aturannya telah diperiksa yang memperoleh hasil kesesuaian. Area kosong tetap diberi penjelasan, bukan disembunyikan seolah tidak memiliki ketentuan.

#### Alur pengguna

1. Buka peta Sulawesi Tenggara dan lihat indikator cakupan data.
2. Cari kode/nama KBLI, pilih versi dan ruang lingkup jika diperlukan.
3. Opsional: batasi kabupaten/kota/kecamatan; filter hanya membatasi tampilan, tidak mengubah dasar aturan.
4. Lihat sorotan zona dengan kategori status yang berbeda.
5. Klik zona untuk membaca dasar pencocokan, syarat, kegiatan lokal dan sumbernya.
6. Simpan pilihan KBLI/wilayah bila diperlukan; konfigurasi eksplorasi tidak membawa luas atau parameter pembentukan kandidat.
7. Jika pengguna kemudian membutuhkan polygon rencana, lanjutkan ke modul terpisah. Luas, kriteria, validasi seluruh bidang, ekspor GIS dan pengajuan resmi bukan fungsi tahap eksplorasi ini.

#### Legenda yang diusulkan

| Tampilan | Makna produk |
|---|---|
| Hijau | Indikasi diizinkan berdasarkan aturan dan pemetaan terverifikasi untuk konteks yang dipilih; bukan persetujuan proyek |
| Kuning + pola/label | Terbatas dan/atau bersyarat; kategori asli dan seluruh syarat tetap ditampilkan |
| Merah | Bukti ketentuan secara eksplisit tidak mengizinkan untuk konteks tersebut; tidak disimpulkan dari ketiadaan data |
| Abu-abu | Tidak dapat dinilai: cakupan, aturan atau pemetaan belum memadai; alasan ditampilkan |
| Garis/pola peringatan | Ada konflik, tumpang tindih, atau versi yang perlu ditinjau; bukan hasil hijau |

Hijau tidak boleh dihasilkan hanya karena nama zona terdengar sesuai, karena kegiatan muncul di daftar filter, atau karena AI menilai istilah mirip. Jika syarat memerlukan data proyek yang belum diisi, tampilkan kebutuhan klarifikasi; sistem tidak menganggap syarat telah terpenuhi. Warna disertai label/simbol yang tetap dapat dibedakan tanpa persepsi warna.

#### Aturan pencocokan

Rancangan relasi: **KBLI + versi + ruang lingkup → kegiatan RDTR lokal → aturan pada rencana/subzona/blok terkait → kategori dan syarat**. Relasi bisa lebih dari satu; tidak dibuat sebagai daftar KBLI universal pada nama zona. Pemetaan ditinjau dan menyimpan rujukan. AI boleh membantu menyiapkan usulan, tetapi tidak menerbitkan keputusan aturan.

Usulan rilis awal memakai satu KBLI agar hasil mudah diaudit. Jika multi-KBLI dimasukkan, pengguna harus memilih `Semua KBLI` atau `Salah satu KBLI`; default usulan untuk kebutuhan satu lokasi adalah `Semua KBLI`. Pada mode semua, merah eksplisit pada satu KBLI mencegah label semua sesuai; adanya status belum diketahui mencegah label hijau penuh. Pada mode salah satu, kecocokan sebagian tidak boleh diberi kesan seluruh kegiatan diterima. Rincian hasil masing-masing KBLI selalu tersedia. Pelaksanaan beberapa kegiatan bersamaan tetap membutuhkan pemeriksaan proyek tersendiri.

#### Data dan operasi

- Discovery menginventarisasi geometri, ketentuan kegiatan, syarat dan sumber resmi yang tersedia untuk Sulawesi Tenggara; tidak mengarang jumlah atau daftar cakupannya.
- Pisahkan peta dasar, batas administratif, geometri RDTR dan relasi kegiatan. Peta dasar atau RTRW tidak otomatis menggantikan ketentuan rinci RDTR yang belum tersedia.
- Periksa ketentuan akses, penyimpanan, pengunduhan dan publikasi ulang sebelum memakai data. Jika tidak diizinkan/disediakan, revisi cakupan atau tampilkan rujukan pemeriksaan manual; jangan mengaku pencarian otomatis lengkap.
- Data yang dipublikasikan memiliki versi, sumber, tanggal pemeriksaan dan status review. Ketika sumber sementara tidak tersedia, versi terakhir tidak disebut live; usulan kebijakan kedaluwarsa harus ditentukan bersama reviewer.
- Untuk respons filter, usulan arsitektur memakai indeks geometri dan relasi yang sudah ditinjau, bukan meminta AI menyimpulkan semua zona setiap kali diklik. Besaran kinerja tetap harus diukur pada data nyata.
- Untuk tampilan provinsi, geometri boleh disederhanakan agar ringan; pemeriksaan bidang dan ekspor memakai geometri analisis yang tidak disederhanakan untuk tampilan.
- Sistem boleh membentuk bagian polygon zona sebagai kandidat rencana sesuai luas dan kriteria, tetapi tidak mengklaimnya sebagai batas kepemilikan. Seluruh zona tidak otomatis menjadi proyek; pembentukan geometri memerlukan parameter yang jelas dan pemeriksaan seluruh hasil.

#### Batas pilot dan gerbang

Usulan: shell peta provinsi sejak awal, dengan dataset lengkap yang ditinjau untuk satu atau beberapa wilayah/KBLI pilot yang disepakati; cakupan diperluas secara terlihat. Ini bukan keputusan membatasi seluruh visi hanya pada satu kabupaten. Sebelum menyebut filter siap produksi, reviewer harus menguji contoh diizinkan, bersyarat, tidak diizinkan dan tidak dapat dinilai menggunakan bukti sumber serta aturan pemetaan yang disepakati.

### 8.6 Rekomendasi lokasi dan generator polygon rencana — koreksi lingkup Anton

#### Makna keluaran dan batas kepastian

Keluaran utamanya adalah **usulan lokasi rencana pada koordinat nyata**, bukan listing tanah siap transaksi, sertifikat hak, hasil survei atau kepastian pelaksanaan usaha. Belum ada informasi pemilik/ketersediaan bukan penghambat mesin rekomendasi. Tidak adanya realisasi di lapangan juga bukan alasan menolak kandidat rencana.

Pisahkan tiga status: `Kecocokan kriteria rencana`, `Bukti yang belum tersedia`, dan `Kesiapan pengajuan resmi`. Rekomendasi dapat tersedia ketika hak/ketersediaan belum diketahui, tetapi nilai tersebut tidak boleh berubah menjadi klaim kosong/tidak dimiliki/bebas hak. PRD ini tidak menyimpulkan bahwa suatu informasi pasti tidak diperlukan oleh semua alur pengajuan; persyaratan resmi diteliti terpisah saat discovery.

#### Contoh masukan dari Anton — bukan ketentuan universal

- Wilayah pencarian: Sulawesi Tenggara, dapat dipersempit pengguna.
- Kegiatan awal dalam contoh adalah pertanian; pilot kini dipilih sebagai 01273/Pertanian Kakao, dengan ruang lingkup budidaya sebagai asumsi yang perlu dikonfirmasi.
- Luas polygon: **5000m2** dipilih sebagai target pilot; toleransi pengukuran/ekspor masih terbuka.
- Kondisi yang dicari: tanah kosong atau area yang disebut pengguna sebagai perhutanan; arti dan sumber pengukurannya perlu diklarifikasi.
- Kesesuaian zona/kegiatan: diperiksa memakai bukti yang dapat ditelusuri.
- Kedekatan jalan: diputuskan Anton sebagai preferensi saja pada pilot, bukan ambang maksimum. Usulan: kandidat yang setara pada dimensi wajib/utama lebih dekat jalan memperoleh nilai preferensi lebih baik. Metode, kelas jalan dan bobot belum dibekukan.

#### Kriteria wajib, preferensi dan usulan tambahan

| Kriteria | Perlakuan awal yang diusulkan | Parameter/bukti |
|---|---|---|
| KBLI/ruang lingkup dan ketentuan lokasi | Penyaringan wajib sesuai kategori yang disepakati; bersyarat tidak berubah menjadi tanpa syarat | Pemetaan terverifikasi, aturan dan versi |
| Luas bidang | Wajib sesuai target dalam toleransi yang disetujui | Luas hitung geodesik/metode yang dinyatakan; uji ulang setelah pembulatan dan ekspor |
| Wilayah pencarian | Wajib bila dipilih | Batas wilayah dan geometri kandidat |
| Geometri valid, utuh dan tidak melintasi area pengecualian terkonfirmasi | Wajib; izin multipart menjadi pilihan terbuka | Pemeriksaan seluruh polygon dan sumber pengecualian |
| Dekat jalan | Pilot: preferensi saja, bukan syarat gugur; tidak ada ambang maksimum | Jarak, geometri jalan, metode, tanggal/sumber; bobot tetap usulan |
| Kondisi tutupan yang diinginkan | Preferensi atau wajib setelah definisi serta sumber disepakati | Klasifikasi tutupan/citra, tanggal, ketidakpastian; bukan pengamatan lapangan |
| Bentuk bidang tidak terlalu sempit/terfragmentasi | Preferensi tambahan | Ukuran bentuk dijelaskan; ambang disetujui |
| Kemiringan, risiko banjir, kedekatan air | Usulan tambahan sesuai kegiatan, tidak aktif sebagai kewajiban secara otomatis | Ketersediaan dataset, resolusi dan relevansi kegiatan diuji |
| Kejelasan/mutakhirnya bukti | Dimensi mutu bukti terpisah dari skor kecocokan | Cakupan, sumber, tanggal dan review |

Kriteria kesuburan atau kecocokan komoditas tidak dianggap sudah terbukti oleh tutupan lahan atau zona; jika diminta, menjadi evaluasi tersendiri dengan sumber yang sesuai. Tambahan sistem harus terlihat dan disetujui. Kriteria baru tidak diterapkan diam-diam sebagai penghalang.

#### Penanganan “tanah kosong”, “perhutanan”, jalan dan hambatan

- Terpisahkan `tutupan yang teramati/terklasifikasi`, `penggunaan lahan`, `status kawasan menurut sumber resmi`, dan `hak/ketersediaan yang belum diperiksa`.
- Istilah perhutanan tidak langsung dianggap satu kategori yang pasti cocok untuk semua kegiatan pertanian. Pengguna mengklarifikasi apakah maksudnya vegetasi/pohon, kebun, atau status kawasan tertentu. Kandidat menyimpan hasil pemeriksaan dan hal yang belum dapat diputuskan; tidak ada kesimpulan hukum otomatis dari tampilan citra.
- Untuk jalan, jarak awal yang diusulkan adalah jarak terpendek batas polygon ke segmen jalan relevan. Jika yang diminta jarak dari titik masuk atau jarak perjalanan, metode tersebut dipilih secara eksplisit dan membutuhkan data tambahan.
- Kedekatan geometris bukan bukti konektivitas, kondisi jalan, izin lewat, atau akses kendaraan. Penghalang sungai/lereng dan kategori jalan diperiksa jika data tersedia; ketiadaan data dicatat, bukan diasumsikan bebas hambatan.
- Polygon tidak ditarik menimpa jalan, badan air atau area pengecualian yang telah terkonfirmasi hanya untuk memenuhi target luas. Daftar pengecualian serta dasar masing-masing ditetapkan pada discovery; ketiadaan layer bukan bukti area bebas batasan.

#### Pembentukan dan pemeringkatan

1. Validasi masukan dan pastikan pengguna mengetahui parameter yang masih belum diisi.
2. Saring zona kandidat dengan status sesuai/bersyarat yang dinyatakan; simpan syarat yang belum dinilai.
3. Bentuk geometri rencana dari area kandidat menggunakan luas, toleransi, bentuk dan batas pengecualian yang disepakati.
4. Uji seluruh geometri terhadap ketentuan, cakupan, luas, tutupan dan kriteria jalan yang berlaku.
5. Tampilkan hasil per kriteria sebagai `Memenuhi`, `Bersyarat`, `Tidak memenuhi`, atau `Belum dapat dipastikan`.
6. Urutkan kandidat yang lolos kriteria wajib menggunakan preferensi yang disepakati; mutu bukti ditampilkan terpisah. Skor bukan probabilitas penerbitan izin.
7. Jika tidak ada hasil yang memenuhi, nyatakan tidak ada kandidat terverifikasi dengan kriteria saat ini. Usulkan perubahan yang eksplisit, tanpa mengubah target luas, lokasi, KBLI atau ambang secara diam-diam.
8. Simpan versi pencarian, kandidat dan keputusan pengguna. Ekspor geometri rencana setelah validasi, dengan catatan pendamping yang tidak mencemari skema unggah target.

Keluaran per kandidat: ID, koordinat/polygon, administrasi jika diketahui, luas target dan hasil hitung, zona dan bukti, hasil masing-masing kriteria, jarak jalan dengan metode, indikasi tutupan beserta waktu sumber, status kawasan jika tersedia, alasan urutan, serta ketidakpastian. Jumlah kandidat, toleransi luas, bobot, batas umur data dan waktu proses belum ditetapkan; tidak ada batas maksimum jarak jalan pada pilot; ditentukan melalui discovery, bukan dikarang dalam contoh hasil.

### 8.7 Kasus pilot yang dipilih Anton — kakao, empat kabupaten

| Parameter | Nilai | Status |
|---|---|---|
| Kode sumber pengguna | **01273** | Dipilih Anton; dipertahankan sebagai string dengan nol awal |
| Kegiatan | Pertanian Kakao | Nama dan versi KBLI 2025 terkonfirmasi pada katalog OSS.[10] |
| Ruang lingkup pilot | Budidaya kakao | Asumsi operasional dari kebutuhan lahan; produksi benih bukan otomatis scope yang sama dan perlu konfirmasi |
| Wilayah | Kolaka Timur, Kolaka, Konawe, Konawe Selatan | Dipilih Anton; tidak diubah menjadi hanya satu kabupaten |
| Luas target | **5000m2** per polygon kandidat sebagai interpretasi awal | Nilai dipilih Anton; toleransi belum disepakati; bukan total dibagi empat wilayah |
| Kriteria utama | Kesesuaian kegiatan/zona dan indikasi lahan cocok untuk kakao | Ditegaskan Anton; rubrik/ambang agronomi dan dataset belum dibekukan |
| Kedekatan jalan | Preferensi saja, bukan syarat gugur | Diputuskan Anton; tidak ada ambang maksimum; metode, kelas jalan dan bobot masih terbuka |
| Keluaran | Kandidat di peta dan berkas polygon SHP ZIP + KML | Tujuan serta format dikonfirmasi Anton; skema, toleransi dan uji target masih terbuka |

Katalog OSS yang dibaca menyebut dua ruang lingkup pada 01273: produksi benih dan kegiatan budidaya kakao. Dokumen ini tidak menganggap pemilihan kode otomatis menentukan semua rincian ruang lingkup proyek.[10]

**Pisahkan dua dimensi hasil:** (1) kesesuaian kegiatan/ketentuan lokasi, dan (2) indikasi kesesuaian tumbuh kakao. Lolos dimensi pertama tidak otomatis meluluskan dimensi kedua. Untuk rancangan evaluasi kedua, inventarisasi data elevasi/kemiringan, iklim, tanah, drainase/genangan dan tutupan; ambang agronomi membutuhkan rujukan yang diperiksa dan review. Tidak menampilkan label sangat cocok atau kelas S1/S2/S3 tanpa dasar penilaian yang sesuai.

#### Hasil discovery awal — metadata, bukan calon lahan

| Kabupaten | Entri RDTR yang dikembalikan katalog publik | Batas temuan |
|---|---|---|
| Kab. Kolaka Timur | RDTR Kawasan Perkotaan Tirawuta; RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[6] |
| Kab. Kolaka | RDTR Kawasan Perkotaan Kolaka; RDTR Kawasan Perkotaan Wolo | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[7] |
| Kab. Konawe | RDTR Wilayah Perencanaan Routa; RDTR Pondidaha | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[8] |
| Kab. Konawe Selatan | RDTR Wilayah Perencanaan Laonti; RDTR Wilayah Perencanaan Angata | Entri katalog ditemukan; luas cakupan/geometri dan ketentuan per bidang belum diuji.[9] |

Snapshot katalog dan daftar kegiatan disimpan pada arsip kerja di luar repositori publik. Ringkasannya tersedia di [discovery pilot kakao](discovery/pilot-kakao.md); snapshot mentah tidak diterbitkan melalui commit awal ini. Seluruh empat kabupaten dan delapan entri rencana yang dikembalikan pada pemeriksaan ini tercatat; angka tersebut bukan klaim seluruh RDTR yang berlaku atau seluruh wilayah kabupaten tercakup.

Pada daftar kegiatan delapan rencana tersebut ditemukan nama kelompok “perkebunan tanaman aromatik/penyegar” dengan variasi penamaan dan ID lokal. Ini **calon relasi yang harus direview**, bukan bukti persetujuan KBLI 01273 atau izin pada semua zona. Entri industri/perdagangan kakao yang juga muncul tidak dipakai sebagai pengganti kegiatan budidaya.[11][12][13]

| Rencana | Calon kegiatan lokal untuk ditelaah, bukan keputusan pemetaan | Sumber |
|---|---|---|
| Kab. Kolaka Timur / RDTR Kawasan Perkotaan Tirawuta | 041 — Perkebunan tanaman aromatik/penyegar | [11] |
| Kab. Kolaka Timur / RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | 041 — Perkebunan tanaman aromatik/penyegar | [12] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Kolaka | 025 — Perkebunan Tanaman Aromatik/Penyegar | [13] |
| Kab. Kolaka / RDTR Kawasan Perkotaan Wolo | 034 — Perkebunan Tanaman Aromatik/Penyegar | [14] |
| Kab. Konawe / RDTR Wilayah Perencanaan Routa | 043 — Perkebunan Tanaman Aromatik/Penyegaran | [15] |
| Kab. Konawe / RDTR Pondidaha | 016 — PERKEBUNAN TANAMAN AROMATIK/PENYEGAR | [16] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Laonti | 044 — Perkebunan Tanaman Aromatik/Penyegar | [17] |
| Kab. Konawe Selatan / RDTR Wilayah Perencanaan Angata | 044 — Perkebunan Tanaman Aromatik/Penyegar | [18] |

Nilai status numerik pada katalog disimpan apa adanya. Wolo tidak dianggap sudah terintegrasi atau siap pengajuan hanya karena muncul di daftar; definisi status dan keberlakuan harus diperiksa sebelum dipakai sebagai dasar kelayakan. Daftar kegiatan bukan matriks izin per zona.

#### Pekerjaan discovery berikutnya dan gerbang

1. Periksa geometri/luas cakupan masing-masing entri, sumber aturan, makna status dan relasi kegiatan budidaya kakao.
2. Inventarisasi sumber jalan, tutupan, medan, tanah dan iklim; catat tanggal, resolusi, hak penggunaan dan kelayakan analisis pada bidang 5000m2. Jangan menyajikan detail tingkat bidang jika sumber hanya mendukung penyaringan regional.
3. Sepakati toleransi luas, jumlah kandidat, metode/bobot preferensi jalan, perlakuan bersyarat/unknown dan rubrik agronomi. Tidak meminta ulang ambang maksimum jalan karena pengguna menetapkannya sebagai preferensi saja.
4. Susun matriks cakupan dan data hilang untuk empat kabupaten tanpa memaksakan kandidat di setiap wilayah.
5. Rancang mockup layar pencarian, bukti dan ekspor dengan batas data yang jujur; pekerjaan ini dapat berjalan paralel dengan audit. Pengujian kandidat nyata, generator GIS dan pembangunan mesin produksi memerlukan gerbang data/rubrik serta persetujuan tersendiri.

Status sebelum audit geometri lanjutan: baru metadata dan daftar kegiatan. Hasil terbaru ada pada bagian 8.9. Pemeriksaan ITBX seluruh bidang proyek, kesesuaian tumbuh per lokasi, kandidat 5000m2 dan uji unggah OSS tetap belum dilakukan; audit sumber tidak sama dengan kelayakan rekomendasi produksi.

### 8.8 Tahap kerja terdekat — menutup risiko data dan aturan, bukan menambah konsep

Keputusan jalan sudah cukup untuk melanjutkan perencanaan. Tidak ada permintaan ulang ambang maksimum. Tabel ini merupakan urutan kerja yang dirumuskan pada v0.5; perkembangan audit terbaru dicatat pada bagian 8.9, bukan menganggap seluruh gerbang telah lulus.

| Urutan | Pekerjaan | Keluaran yang harus dapat diperiksa | Gerbang sebelum lanjut |
|---|---|---|---|
| 1 | Audit geometri/cakupan, sumber ketentuan, status rencana dan pemetaan kegiatan pilot pada empat kabupaten | Matriks per rencana: sumber, geometri, cakupan, kategori/ketentuan yang terbukti, unknown dan fallback | Dapat dibedakan area dapat dinilai, bersyarat dan belum dapat dinilai; tidak menganggap nama kelompok sebagai penerimaan exact-KBLI |
| 2 | Audit data medan, tanah, iklim, tutupan dan jalan beserta hak penggunaannya | Matriks dataset: sumber, akses, izin pemakaian, tanggal, resolusi dan keterbatasan untuk bidang 5000m2 | Ada dasar rubrik; jika bukti hanya regional, hasil dan cakupan produk dinyatakan sesuai keterbatasannya |
| 3 | Susun rubrik penilaian pilot dan kontrak ekspor | Kriteria wajib/preferensi, asal tiap ambang, perlakuan unknown, toleransi luas, bentuk/jumlah kandidat, usulan format file dan kasus penerimaan | Reviewer menyetujui rubrik/kontrak; jalan tetap preferensi dan tidak menutup kegagalan kriteria wajib |
| 4 | Rancang mockup alur pengguna | Peta/filter, form luas/kriteria, daftar perbandingan kandidat, panel bukti dan ekspor; placeholder berlabel bila belum ada hasil nyata | Anton memeriksa alur dan batas klaim; mockup bukan validasi lokasi |
| 5 | Finalisasi PRD dan desain teknis/backlog | Scope rilis, pengecualian, pengamanan, matriks uji, dependensi, rencana pengembangan dan estimasi berbasis lingkup | Persetujuan development eksplisit; tidak menganggap revisi PRD sebagai perintah membangun |

Audit sumber dan penyusunan rubrik dapat berjalan berdampingan. Mockup tidak harus menunggu semua wilayah lengkap, tetapi tidak boleh berisi lokasi yang disajikan sebagai kandidat terverifikasi tanpa pemeriksaan. Penetapan kandidat nyata dan ekspor GIS merupakan langkah uji/pelaksanaan berikutnya setelah data dan kriteria yang diperlukan cukup, bukan sesuatu yang dianggap sudah terjadi pada tahap perencanaan ini.

### 8.9 Perkembangan audit dan batas keputusan terbaru

Audit baca-saja terhadap delapan layer menghasilkan 15859 fitur yang seluruh object ID-nya direkonsiliasi dengan server. Pengujian lokal menemukan 15848 geometri valid dan 11 invalid. Pada 35 sampel interior untuk kelompok kegiatan lokal, wilayah/rencana/subzona respons cocok; kategori berbeda terdiri dari 12 diizinkan, 20 terbatas dan 3 terbatas serta bersyarat. Rincian sumber, metode dan batas bukti tersedia di [laporan audit](discovery/rdtr-geometry-audit.md).

Angka tersebut bukan jumlah calon lahan, bukan seluruh wilayah kabupaten, dan bukan penerimaan exact-KBLI01273. Pemetaan kelompok lokal ke budidaya kakao masih perlu review, ketentuan berbasis luas blok/dokumen sumber belum dituntaskan, dan kesesuaian agronomi belum dinilai. Geometri invalid tidak diperbaiki/diterima diam-diam untuk pembentukan kandidat.

Pengguna mengonfirmasi SHP ZIP dan KML pada formulir, tetapi melewati pertanyaan ruang lingkup budidaya, usulan polygon utuh/toleransi ±1m2, serta kebijakan menampilkan kandidat dengan agronomi belum lengkap. Ketiganya tetap terbuka, bukan persetujuan implisit; pekerjaan audit sumber dan rancangan layar yang tidak bergantung pada jawabannya tetap dapat berjalan.

Izin melanjutkan proyek memungkinkan tahap audit, rubrik dan mockup dikerjakan. Dokumen ini tidak menganggap seluruh usulan MVP, parameter penilaian, penggunaan data klien, layanan berbayar atau pengiriman OSS sudah disetujui.

### 8.10 Bahan review sumber, rubrik dan mockup

[Inventaris sumber](discovery/data-sources.md) dan [rubrik usulan](design/scoring-rubric.md) sudah tersedia untuk review. Uji akses sampel tidak disamakan dengan cakupan lengkap empat kabupaten; raster regional bukan bukti kondisi mikro bidang 5000m2. Ambang dalam rancangan tetap nonaktif sampai disetujui reviewer/pengguna yang berwenang. PDF referensi Kementan telah diperoleh, tetapi pembacaan OCR bagian agronomi belum selesai.

[Prototipe interaktif](design/mockup.md) dapat dijalankan lokal, memuat filter KBLI/wilayah, peta dasar opt-in, inventaris/ringkasan audit, panel bukti dan ekspor konfigurasi. Riwayat pembuktian satu rencana dijelaskan pada bagian 8.11; kontrak perluasan kini pada bagian 8.12. Ini bukan mesin rekomendasi kandidat: nol kandidat proyek dievaluasi, tidak ada polygon rekaan atau ekspor GIS. Format tujuan SHP ZIP + KML tetap tercatat sebagai keputusan pengguna. Tes teknis tidak menggantikan UAT seluruh produk, validasi agronomi, uji OSS atau persetujuan alur oleh Anton.

### 8.11 Riwayat pembuktian sorotan Tirawuta — checkpoint 25 Oktober 2026

Atas permintaan kelanjutan implementasi, satu irisan geometri **RDTR Kawasan Perkotaan Tirawuta (`7411000000:001`)** telah dihubungkan ke API lokal dan peta. Pemilihan satu rencana adalah urutan pembuktian teknis, bukan penggantian empat kabupaten pilot atau persetujuan stack produksi. Pada checkpoint tersebut tujuh rencana lain masih inventaris metadata; status kini mengikuti bagian 8.12.

Pada 25 Oktober 2026, sumber publik menghasilkan **20 polygon P-3** yang direkonsiliasi dan tampil di peta. Dasar sorotan adalah filter kegiatan lokal `041`; relasi exact-KBLI `01273` versi `2025` dan asumsi budidaya belum direview/dikonfirmasi. Seluruh fitur tetap `permission: unknown`, `evidence_status: unreviewed_mapping`, dengan legenda **biru putus-putus: relevan untuk ditelaah**. Bukan hasil kesesuaian terverifikasi atau persetujuan OSS.

API dibatasi pada pilot, memvalidasi ID/CRS/topologi, mengarantina invalid tanpa perbaikan diam-diam, serta memberi provenance cache/waktu sumber. Tidak ada input luas/jalan, kandidat bidang atau geometri dalam ekspor konfigurasi. Kegagalan API atau perubahan kriteria membersihkan lapisan; respons lama tidak boleh diterapkan ke konteks baru.

Hasil eksekusi terpisah: **11 test backend offline**, **1 test kontrak frontend** dan **18 pemeriksaan browser** lulus. Browser membuktikan polygon nyata, klik interior, detail sumber, filter/kegagalan, keyboard/seluler dan unduhan yang dibaca ulang. [Kontrak dan laporan](design/zone-overlay.md), [rekaman hasil](design/zone-overlay-verification.json), [API serta probe live](design/zone-api.md). Ini belum memenuhi Definition of Done seluruh produk pada bagian 17.

### 8.12 Eksplorasi lintas-rencana — kontrak perluasan

Registry versi 1 memuat 17 wilayah/18 rencana sebagai `curated_source_snapshot`, bukan katalog live. Enam wilayah tidak tercantum tetap selectable dengan namespace internal/source ID null. Dua rencana beraktivitas null tidak meminjam kegiatan rencana lain; celah bukan larangan.

Setelah peta diaktifkan, semua rencana beraktivitas pada wilayah terapan diminta bertahap, maksimal 3 serentak/timeout 120 detik. Filter, ID kegiatan, sumber/CRS dan cache terikat rencana immutable; detail fitur terikat koleksi asal melalui `(planId,objectId)`. Status berhasil/pending/gagal/unknown terpisah. Penerapan filter membersihkan konteks lama dan mengabaikan respons terlambat.

Lasalimu memakai calon 014 bahan minuman, bukan 015 rempah/aromatik. Langara memfilter KODUNK bertitik, kode subzona tetap KODSZN. Matahora memakai batch 5, semua query dibatasi 200 ID dan 1900 byte URL. Semua hasil unreviewed/unknown, bukan pemetaan exact-KBLI final. Konfigurasi skema 3 tanpa geometri atau parameter kandidat. [Kontrak API/klien](design/province-api.md), [registry](../tools/rdtr-plans.json), [audit historis terkoreksi](discovery/sultra-01273-source-audit.json).

## 9. Pengalaman pengguna

**Perkembangan filter v0.9:** seluruh 15 kabupaten dan 2 kota tersedia, default/reset semua terpilih. Pilih semua/Kosongkan mengubah draf; penerapan dan ekspor memakai kriteria terapan. Wilayah kosong ditolak. Ketiadaan inventaris/sorotan ditampilkan sebagai belum tersedia, bukan tidak ada RDTR atau kegiatan dilarang. Sebelas ID wilayah sumber GISTARU direkonsiliasi; enam yang belum terpetakan memakai namespace internal dengan `gistaruId: null`, bukan kode resmi rekaan. [Kontrak, sumber dan hasil uji](design/region-filter.md).

### Halaman yang diusulkan

1. Dashboard: proyek aktif, menunggu dokumen, menunggu review, hambatan dan tindak lanjut.
2. Daftar perusahaan/proyek: pencarian, filter dan penanggung jawab.
3. Ruang kerja proyek: ringkasan, tahapan, temuan dan tindakan berikutnya.
4. Pemeriksaan dokumen: sumber berdampingan dengan hasil ekstraksi dan koreksi.
5. Kegiatan/KBLI: uraian aktual, kandidat, pembanding dan keputusan.
6. Peta dan Rekomendasi Lokasi Rencana Sulawesi Tenggara: filter KBLI, luas/kriteria, sorotan zona, kandidat polygon, perbandingan alasan, detail bukti, ekspor rencana dan pemeriksaan lokasi yang sudah ada.
7. Tinjauan akhir: perubahan, penghambat, persetujuan dan ekspor paket.
8. Proses eksternal/tindak lanjut: bukti, hasil resmi dan daftar pekerjaan.
9. Riwayat: versi data, pemeriksaan dan jejak keputusan.

Antarmuka dan pesan kesalahan menggunakan bahasa Indonesia. Perbedaan status tidak hanya ditandai warna. Tampilan harus memperlihatkan tugas berikutnya dan alasan suatu proses terhambat.

## 10. Keamanan, privasi dan persyaratan nonfungsional

Persyaratan ini adalah rancangan kontrol produk; pemeriksaan kewajiban hukum dan kontrak pemrosesan data masih perlu dilakukan.

- Penyimpanan dokumen privat, akses berjangka waktu jika memakai tautan unduh, dan pembatasan akses pada level proyek/organisasi.
- Enkripsi koneksi dan enkripsi penyimpanan sesuai kemampuan penyedia yang dipilih; konfigurasi wajib diuji sebelum data nyata.
- Rahasia aplikasi, token dan sesi disimpan pada penyimpanan rahasia yang sesuai, bukan repositori atau log.
- Pengiriman dokumen ke penyedia AI/OCR eksternal tidak diaktifkan sebelum kebijakan penyimpanan, pemanfaatan data dan persetujuan yang diperlukan ditetapkan.
- Sebisa mungkin kirim hanya bagian data yang diperlukan; log menghindari identitas sensitif dan isi dokumen lengkap.
- Unggahan diperiksa terhadap file berbahaya, arsip rusak, isi tak sesuai ekstensi dan arsip yang mengekstrak di luar direktori tujuan.
- Pengujian memakai berkas sintetis atau disamarkan bila belum ada izin memakai dokumen nyata.
- Kebijakan retensi, penghapusan, ekspor arsip dan penanganan permintaan pemilik data harus diputuskan sebelum produksi.
- Log audit mencatat aktor, aksi, target, waktu dan versi; koreksi memakai kejadian baru, bukan menghapus riwayat tanpa jejak.
- Pekerjaan lama berjalan asinkron dengan status yang terlihat; timeout tidak menghapus pekerjaan atau memunculkan keberhasilan palsu.
- Ada backup dan latihan pemulihan; target kehilangan data yang dapat diterima dan waktu pemulihan belum ditetapkan.
- Ada pencatatan biaya per proyek untuk AI/OCR, penyimpanan dan pekerjaan otomasi.
- Waktu respons, kapasitas pengguna dan kapasitas dokumen ditetapkan setelah ukuran berkas serta volume pengguna diketahui; PRD tidak menetapkan angka tanpa baseline.
- Lingkungan pengembangan, pengujian dan produksi dipisah. Data produksi tidak otomatis disalin ke lingkungan lain.

## 11. Ukuran keberhasilan dan cara pengukuran

Target berikut adalah usulan awal; angka final disepakati setelah pengukuran proses manual.

| Indikator | Definisi dan metode | Target awal |
|---|---|---|
| Ketepatan ekstraksi sebelum koreksi | Nilai yang benar dibanding seluruh nilai berlabel pada korpus uji; pisahkan per kolom dan PDF teks/scan | Belum ditetapkan; laporan per kolom wajib |
| Kelengkapan kolom kritis final | Semua kolom kritis telah dicek terhadap sumber oleh reviewer | Tidak ada kolom kritis yang belum dikonfirmasi pada paket final |
| Ketertelusuran | Persetujuan/rekomendasi memiliki versi input dan bukti sumber | Seluruh hasil final memiliki provenance atau label manual yang jelas |
| Waktu kerja aktif | Waktu kerja operator pada kasus setara sebelum/sesudah; tidak disamakan dengan waktu tunggu instansi | Baseline dan target ditetapkan saat pilot |
| Koreksi ulang | Jumlah revisi karena kesalahan internal per proyek | Baseline dahulu, lalu target pengurangan |
| Konsistensi paket | Isi ekspor cocok dengan versi yang disetujui | Tidak ada mismatch pada kasus penerimaan |
| Keamanan tindakan eksternal | Pengiriman tanpa otorisasi atau pengiriman ganda akibat retry | Tidak terjadi dalam pengujian penerimaan |
| Pemulihan tugas | Tugas yang terputus dapat dilanjutkan dengan hasil terdahulu tetap terlacak | Semua skenario gangguan yang disepakati lulus |
| Biaya proses | Biaya komputasi/AI langsung per berkas yang selesai diproses | Dicatat pada pilot; batas diputuskan kemudian |
| Kepatuhan kandidat pada kriteria | Uji seluruh geometri, luas dan kriteria wajib terhadap konfigurasi pencarian | Kandidat tidak dilabeli memenuhi bila ada kriteria wajib yang gagal atau belum diketahui |
| Ketertelusuran pemeringkatan | Pengguna dapat melihat kriteria aktif, alasan urutan, sumber dan nilai yang belum diketahui | Tidak ada perubahan kriteria diam-diam; skor tidak diklaim sebagai peluang izin |

Keberhasilan penerbitan izin tidak menjadi ukuran tunggal kualitas produk, karena keputusan eksternal dan kondisi substantif bukan kendali aplikasi.

## 12. Skenario uji penerimaan

| ID | Kondisi / tindakan | Hasil yang wajib diamati |
|---|---|---|
| UAT-01 | Dokumen jelas dan data konsisten | Ekstraksi memiliki rujukan, koreksi tersedia, paket dapat disetujui setelah pemeriksaan |
| UAT-02 | Scan buram atau halaman hilang | Ditandai tidak terbaca/tidak lengkap; sistem tidak mengisi fakta pengganti |
| UAT-03 | Akta pendirian dan perubahan berbeda | Konflik terlihat dan reviewer menentukan dasar yang dipakai |
| UAT-04 | Kegiatan usaha ambigu | Sistem mengajukan klarifikasi dan tidak mengunci satu KBLI secara otomatis |
| UAT-05 | Versi KBLI berbeda atau pemetaan bercabang | Asli dipertahankan, pilihan target perlu review dan bukti |
| UAT-06 | RDTR tidak tersedia, belum tercakup atau tak dapat diakses | Hasil belum dapat dipastikan; ada jalur manual dan catatan keterbatasan |
| UAT-07 | Polygon melintasi lebih dari satu zona | Semua irisan dan area tanpa cakupan dilaporkan |
| UAT-08 | Geometri tidak valid, CRS salah/tidak diketahui atau luas berbeda | Temuan spesifik; tidak menggeser batas atau menebak CRS tanpa konfirmasi |
| UAT-09 | Lokasi/KBLI berubah setelah disetujui | Persetujuan turunannya tidak lagi berlaku; paket lama tidak bisa dipakai sebagai versi terbaru |
| UAT-10 | Pengguna tanpa akses membuka URL langsung atau API | Akses ditolak, bukan sekadar menu disembunyikan |
| UAT-11 | Worker berhenti saat OCR/ekspor | Status gagal/tertunda akurat dan tugas dapat diulang tanpa hilang riwayat |
| UAT-12 | Ekspor paket dan polygon | Isi dibaca ulang, cocok dengan versi disetujui, berkas asli tidak berubah |
| UAT-13 | Dokumen memuat instruksi untuk mengirim data atau mengabaikan aturan | Instruksi diperlakukan sebagai isi dokumen, tidak dijalankan |
| UAT-14 | Pengguna mencatat NIB tetapi masih ada tugas dalam lingkup pekerjaan | Hasil tersimpan; proyek tidak otomatis selesai |
| UAT-15 | Fase otomasi: timeout setelah pengiriman | Sistem memeriksa efek pada target sebelum retry, tidak membuat pengajuan ganda |
| UAT-16 | Fase otomasi: UI berubah/OTP muncul | Worker berhenti aman dan menyerahkan kontrol kepada pengguna |
| UAT-17 | Pilih KBLI dan klik zona yang memiliki dasar terverifikasi | Sorotan sesuai kategori; detail menyebut sumber, pemetaan dan syarat, tanpa klaim izin terbit |
| UAT-18 | Zona/wilayah belum memiliki data atau pemetaan | Abu-abu dengan alasan; tidak otomatis merah/hijau; tidak menghilang tanpa penjelasan |
| UAT-19 | Ketentuan berbeda pada kode/nama zona yang sama di rencana berbeda | Sistem memakai aturan masing-masing rencana, bukan menyamaratakan berdasarkan nama |
| UAT-20 | Kegiatan bersyarat, syarat belum dievaluasi | Label kondisi tetap terlihat; tidak disamakan dengan diizinkan tanpa syarat |
| UAT-21 | Multi-KBLI mode semua vs salah satu | Agregasi dan label berbeda sesuai mode; hasil tiap KBLI dan status belum diketahui tetap tersedia |
| UAT-22 | Pengguna memilih zona dan meminta polygon rencana | Sistem boleh membentuk geometri sesuai parameter, berlabel rencana, tanpa klaim hak/ketersediaan; pemeriksaan seluruh bidang dan review pengajuan tetap terpisah |
| UAT-23 | Sumber data atau pemetaan berubah, stale atau bertentangan | Versi dan peringatan terlihat; hasil terkait ditandai perlu tinjau, histori tetap ada |
| UAT-24 | Geometri tampilan disederhanakan | Analisis bidang dan ekspor menggunakan geometri analisis, bukan geometri tampilan |
| UAT-25 | Tidak ada informasi pemilik/ketersediaan/realisasi | Kandidat rencana masih boleh dihasilkan; status tersebut tetap belum diperiksa, tidak otomatis menjadi bebas hak/siap realisasi |
| UAT-26 | Masukan contoh luas 5000 m2 | Luas hasil dihitung dan diuji terhadap target/toleransi yang disepakati, termasuk setelah ekspor; nilai tidak hanya diisi pada atribut |
| UAT-27 | Ada satu kriteria wajib gagal tetapi preferensi sangat baik | Kandidat tidak dilabeli memenuhi semua kriteria; skor tidak mengalahkan kegagalan wajib |
| UAT-28 | Semua kandidat gagal atau bukti kriteria wajib hilang | Sistem menyatakan tidak ada hasil memenuhi atau belum dapat dipastikan, tidak mengarang kandidat dan tidak melonggarkan parameter |
| UAT-29 | Kandidat dekat jalan secara geometris, tetapi konektivitas tidak diketahui | Jarak dan metode tampil; tidak ada klaim dapat diakses/dilalui kendaraan |
| UAT-30 | Citra tampak kosong/berpohon, status kawasan tidak diketahui | Tutupan menjadi indikasi beserta sumber/tanggal; status kawasan dan hak tidak disimpulkan dari citra |
| UAT-31 | Sistem menyarankan kriteria kemiringan/banjir | Pengguna mengetahui dan menyetujui perannya; tidak tiba-tiba menolak kandidat karena syarat baru tersembunyi |
| UAT-32 | Pengguna mengubah luas, ambang jalan atau bobot | Kandidat dihitung ulang berversi dan hasil turunan yang relevan perlu review; batas existing tidak diubah tanpa izin |
| UAT-33 | Polygon rencana dipilih untuk pengajuan | Label asal tetap tersimpan; pemeriksaan data/persyaratan target dilakukan terpisah, bukan dianggap lolos karena peringkat tinggi |
| UAT-34 | Zona mendukung kegiatan, data agronomi belum cukup | Tidak diberi label sudah cocok tumbuh kakao; dimensi agronomi belum dapat dipastikan |
| UAT-35 | Data tanah/iklim hanya cocok untuk penyaringan regional | Resolusi dan keterbatasan ditampilkan; tidak menciptakan detail bidang atau kelas kesesuaian palsu |
| UAT-36 | Satu kabupaten tidak memiliki kandidat terverifikasi | Wilayah tetap tercatat dalam hasil dengan sebab; tidak mengarang kandidat demi memenuhi kuota |
| UAT-37 | Kandidat memenuhi kriteria wajib tetapi jauh dari jalan, atau data jalan tidak tersedia | Jarak jauh tidak menyebabkan gugur; nilai preferensi/mutu bukti terlihat. Data hilang tidak dianggap jarak nol atau akses baik, dan tidak ada ambang tersembunyi |
| UAT-38 | Fitur sumber RDTR invalid atau perbaikan belum diperiksa | Tidak dipakai diam-diam untuk kandidat; asli, temuan dan status karantina dapat ditelusuri |
| UAT-39 | Nama/kode subzona sama tetapi aturan lokal atau blok berbeda | Tidak menyamakan seluruh izin berdasarkan nama zona atau satu titik sampel; ruang lingkup bukti dan syarat per konteks tetap terlihat |
| UAT-40 | Eksplorasi KBLI tanpa input luas | Tidak ada field/validasi/ringkasan luas atau parameter kandidat di konfigurasi eksplorasi; filter, reset dan ekspor konfigurasi tetap bekerja |
| UAT-41 | Geometri filter kelompok kegiatan tampil, relasi exact-KBLI belum direview | Sorotan hanya relevan untuk ditelaah, tanpa warna/keputusan izin; fitur dan detail memuat ID, sumber, waktu, cakupan serta unknown. Tile peta dasar saja tidak dianggap kelulusan sorotan |
| UAT-42 | Respons geometri rusak atau respons lama tiba setelah filter berubah | Lapisan lama dibersihkan; payload rusak tidak digambar dan respons konteks sebelumnya diabaikan. Cache sah berlabel snapshot dengan timestamp sumber asli; tidak ada polygon contoh sebagai fallback |
| UAT-43 | Memilih kabupaten/kota mana pun di Sulawesi Tenggara | Seluruh 17 pilihan dapat diterapkan, dicampur dan diekspor; kontrol massal hanya mengubah draf, reset kembali 17 dan pilihan kosong ditolak. ID internal tidak disebut kode resmi; wilayah tanpa inventaris/sorotan tetap belum dievaluasi |
| UAT-44 | Semua rencana terpilih, OID sama lintasrencana | Inventaris snapshot lengkap; detail/cache tidak tertukar. Semua geometri respons sah digambar, pembatasan daftar berpaginasi dapat dioperasikan dengan keyboard untuk seluruh fitur |
| UAT-45 | Sebagian sumber gagal, aktivitas null atau wilayah tidak tercantum | Hasil sah dipertahankan dengan status parsial/error/unavailable; tanpa geometri pengganti, keputusan izin atau ekstrapolasi titik |
| UAT-46 | Ekspor saat request/draf berubah | Unduhan nyata identik dengan pratinjau skema 3, provenance/counts per rencana pada waktu snapshot; tanpa geometri/luas/jalan/kandidat |

UAT-15 dan UAT-16 adalah gerbang fase otomasi, bukan syarat MVP tanpa integrasi. UAT-17 sampai UAT-20 dan UAT-22 sampai UAT-46 mencakup eksplorasi serta modul rekomendasi rencana yang terpisah; UAT-21 berlaku jika multi-KBLI masuk rilis. Uji teknis eksplorasi satu rencana tidak menyatakan seluruh UAT produk lulus; rincian korpus/label pembanding untuk rilis harus disepakati.

## 13. Cakupan rilis dan gerbang kelulusan

### Fase 0 — Discovery dan validasi dependensi

Keluaran:
- Satu skenario pilot: jenis pelaku usaha, sektor, wilayah dan jenis pengurusan; provinsi awal yang diusulkan Anton adalah Sulawesi Tenggara.
- Inventaris cakupan peta, aturan RDTR, pemetaan KBLI serta data jalan/tutupan dan layer tambahan di Sulawesi Tenggara; pilih data pilot dan sepakati legenda, mutu sumber, toleransi luas, kriteria wajib/preferensi serta metode jarak.
- Pisahkan parameter pembentukan kandidat rencana dari daftar persyaratan pengajuan resmi; ketersediaan tanah dan realisasi bukan prasyarat rekomendasi.
- Contoh berkas yang diizinkan, termasuk contoh gagal atau perlu revisi.
- Peta proses manual dari operator hingga hasil akhir dan pihak yang menyetujui.
- Daftar kolom, sumber data, aturan pemeriksaan dan definisi selesai.
- Baseline waktu kerja dan kesalahan.
- Verifikasi versi KBLI, akses sumber RDTR, format polygon dan cara kerja target OSS.
- Keputusan kebijakan data serta anggaran awal.

**Gerbang:** Anton menyetujui PRD revisi, cakupan pilot, korpus uji dan penanganan sumber data yang tidak tersedia. Tidak perlu memulai build penuh sebelum dependensi paling berisiko diperiksa.

### Fase 1 — MVP paket siap input

Keluaran usulan: F-01 sampai F-16 serta F-20 sampai F-24 dan F-26 sampai F-40 dalam cakupan pilot, termasuk pembentukan kandidat polygon rencana. Kebutuhan ini dicatat sebagai cakupan yang diminta; prioritas dan besar rilis tetap perlu disepakati. Peta memiliki area tampilan Sulawesi Tenggara dengan cakupan dataset yang ditandai jujur; prioritas ini masih memerlukan persetujuan Anton. Pemeriksaan manual dapat melengkapi kasus tertentu, tetapi tidak boleh menggantikan dataset filter otomatis lalu mengklaim cakupannya lengkap. Penginputan OSS tetap dilakukan operator dan hasilnya dicatat.

**Gerbang:** seluruh UAT P0 yang berlaku lulus pada data uji yang disepakati; hak akses, backup/pemulihan, ekspor dan audit teruji; temuan kritis terselesaikan.

### Fase 2 — Bantuan penginputan dan pemantauan OSS

Keluaran: F-17 sampai F-19 untuk skenario yang telah disetujui, dengan fallback manual; F-25 menjadi kandidat perluasan multi-KBLI setelah filter tunggal teruji.

**Gerbang:** kelayakan akses terkonfirmasi, akun terotorisasi tersedia, pengamanan kirim/retry diuji dan efek eksternal dibaca kembali. Jika akses tidak diizinkan atau tidak stabil, pertahankan paket siap input; jangan menjanjikan otomasi penuh.

### Fase 3 — Perluasan

Kandidat: cakupan RDTR/KBLI Sulawesi Tenggara yang lebih luas, provinsi lain, sektor dan variasi pelaku usaha tambahan, portal klien dan integrasi lain. Verifikasi tanah siap transaksi/realisasi bukan tujuan utama produk dan tidak diasumsikan sebagai fase wajib. Masing-masing memerlukan keputusan cakupan dan uji penerimaan baru.

Estimasi durasi dan biaya belum ditetapkan. Keduanya baru layak dihitung setelah Fase 0, bukan dengan menganggap semua dependensi telah tersedia.

## 14. Arah teknis — bukan keputusan produk yang sudah final

Usulan dari diskusi sebelumnya:

- Next.js/TypeScript untuk antarmuka.
- FastAPI/Pydantic untuk backend Python modular.
- PostgreSQL/PostGIS untuk data transaksional dan spasial.
- Penyimpanan objek privat untuk berkas.
- Pustaka GIS Python dan peta browser untuk pengolahan serta tampilan.
- Antrean tugas dan worker untuk OCR, AI, GIS dan otomasi.
- Playwright sebagai kandidat konektor browser; bukan bukti kelayakan OSS.
- Docker Compose sebagai kandidat deployment awal.

Penyedia AI/OCR, antrean tugas, pustaka ekspor, layanan hosting dan autentikasi belum dibekukan. PRD menentukan perilaku dan kontrol; versi paket, skema API, deployment dan detail komponen dipindahkan ke dokumen desain teknis setelah kebutuhan disepakati. MVP tidak membutuhkan microservices, vector database khusus atau framework multi-agent sebagai prasyarat.

## 15. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi / keputusan |
|---|---|---|
| Ekstraksi AI keliru | Data pengajuan salah | Sumber per kolom, klarifikasi, review kolom kritis |
| Versi KBLI dan pemetaan berbeda | Kode tidak sesuai target | Katalog berversi, konversi terlacak dan review |
| RDTR tidak lengkap/tidak dapat diakses | Kesimpulan keliru | Status belum dapat dipastikan dan proses manual berbukti |
| Asal polygon rencana disalahartikan sebagai bidang terukur | Klaim kepemilikan/keadaan lapangan tidak berdasar | Pisahkan jenis geometri, tampilkan sumber dan label rencana, pertahankan review sebelum pemakaian resmi |
| Kandidat tampak cocok tetapi data jalan/tutupan/ketentuan tidak lengkap | Pemeringkatan menyesatkan | Status unknown per kriteria, sumber/tanggal, skor kecocokan terpisah dari mutu bukti dan tanpa jaminan izin |
| Perubahan UI/akses OSS | Otomasi berhenti atau salah tindakan | Adapter terpisah, stop aman, fallback manual |
| Timeout setelah kirim | Pengajuan ganda | Status efek tidak diketahui dan rekonsiliasi sebelum ulang |
| Kebocoran akta atau sesi | Kerugian privasi/akun | Akses privat, pemisahan sesi, minimisasi data, redaksi log |
| Banyak skenario di awal | Biaya dan kompleksitas tak terkendali | Pilot satu cakupan dan gerbang ekspansi |
| Usulan aturan dianggap kepastian hukum | Pengguna terlalu percaya hasil | Label status bukti, review ahli, tanpa klaim jaminan izin |
| Sumber data tidak boleh diintegrasikan | Fitur otomatis tidak layak | Pemeriksaan ketentuan, jalur manual dan perubahan scope |

## 16. Keputusan yang harus diambil sebelum development

| ID | Pertanyaan | Penanggung jawab awal | Dampak |
|---|---|---|---|
| Q-01 | Pengguna awal siapa, berapa orang, dan berapa berkas per bulan? | Anton | Akses, kapasitas dan prioritas |
| Q-02 | Terjawab: pilot 01273/Pertanian Kakao di Kolaka Timur, Kolaka, Konawe dan Konawe Selatan; luas target 5000m2; kandidat peta dan berkas polygon. Lihat 8.7 | Anton | Parameter utama pilot ditetapkan; bukan persetujuan seluruh scope produk |
| Q-03 | Pengurusan baru, perubahan, atau keduanya? Pelaku usaha apa yang didukung? | Anton | Alur dokumen dan OSS |
| Q-04 | Rekomendasi lokasi/polygon rencana termasuk kebutuhan yang ditegaskan; apakah pilot juga harus menangani batas existing dan format apa? | Anton | Dua mode GIS dan sumber data |
| Q-05 | Apakah MVP paket siap input sudah bernilai, atau bantuan isi OSS wajib sejak pilot? | Anton | Risiko serta batas rilis |
| Q-06 | Dokumen sampel dan contoh pengajuan bermasalah apa yang boleh dipakai? | Anton | Evaluasi ekstraksi dan aturan |
| Q-07 | Siapa boleh menyetujui, dan apakah pemeriksaan dua orang wajib? | Anton | Matriks akses serta persetujuan |
| Q-08 | Boleh memakai layanan AI/cloud eksternal? Ada batas lokasi penyimpanan atau retensi? | Anton + penanggung jawab data | Arsitektur dan penyedia |
| Q-09 | Anggaran awal, batas biaya rutin, dan tenggat bisnis? | Anton | Prioritas dan rencana pelaksanaan |
| Q-10 | Hasil resmi apa yang menjadi definisi selesai untuk tiap jenis kasus? | Anton + reviewer substansi | Status proyek dan penerimaan |
| Q-11 | Siapa berwenang memvalidasi aturan dan pembaruannya? | Anton | Tata kelola katalog |
| Q-12 | Format ekspor terjawab: SHP ZIP dan KML. Tersisa kanal notifikasi, skema atribut dan kebijakan arsip | Anton | UX, ekspor dan integrasi |
| Q-13 | Apakah peta/filter menjadi prioritas wajib MVP, dan apakah satu KBLI dahulu cukup? | Anton | Scope, UX dan agregasi |
| Q-14 | Siapa meninjau relasi KBLI–kegiatan–ketentuan dan seberapa sering diperbarui? | Anton + reviewer | Kepercayaan hasil dan beban operasi |
| Q-15 | Apakah ada data resmi Sulawesi Tenggara yang sudah dimiliki dan boleh dipakai/disajikan ulang? | Anton + penanggung jawab data | Sumber, lisensi dan keluasan rilis |
| Q-16 | Toleransi luas, polygon utuh/multipart dan jumlah kandidat belum diputuskan; usulan ±1m2/polygon utuh dilewati pada formulir, bukan disetujui | Anton + reviewer GIS | Generator geometri dan penerimaan |
| Q-17 | Maksud perhutanan: tutupan berpohon/kebun atau status kawasan tertentu? Tutupan menjadi wajib atau preferensi? | Anton + reviewer | Definisi kriteria dan kebutuhan layer |
| Q-18 | Terjawab: jalan hanya preferensi, tanpa batas maksimum sebagai syarat gugur. Tersisa pemilihan metode, kelas jalan dan bobot yang dapat diusulkan setelah audit sumber | Anton + reviewer GIS | Pemeringkatan dan bukti, bukan penyaringan wajib |
| Q-19 | Kriteria tambahan apa yang disetujui: bentuk, kemiringan, banjir, air dan batas pengecualian? | Anton + reviewer | Scope data dan bobot |
| Q-20 | Kebijakan kandidat bersyarat/agronomi belum lengkap belum diputuskan; pertanyaan dilewati, bukan persetujuan menampilkan kandidat indikatif | Anton + reviewer | Status kecocokan dan batas penggunaan |
| Q-21 | Konfirmasi budidaya atau produksi benih dilewati; budidaya tetap asumsi kerja. Rubrik/ambang serta reviewer agronomi belum final | Anton + reviewer agronomi | Model kecocokan dan batas klaim |

## 17. Definition of Ready dan Definition of Done

### Siap masuk development

- [ ] Cakupan pilot dan pengecualian disetujui.
- [ ] Peran, hak akses, alur serta gerbang persetujuan disetujui.
- [ ] Contoh dokumen diizinkan dan label pembanding tersedia.
- [ ] Kolom kritis, kontrak data dan kriteria penerimaan ditetapkan.
- [ ] Akses sumber data serta fallback-nya diperiksa.
- [ ] Cakupan data pilot Sulawesi Tenggara, sumber, legenda, metode pemetaan KBLI dan penanggung jawab review peta disetujui.
- [ ] Kriteria rencana wajib/preferensi, target/toleransi luas, metode jarak jalan, definisi tutupan dan penanganan unknown disetujui.
- [ ] Kebijakan data dan penggunaan AI/cloud disetujui.
- [ ] Biaya, prioritas serta batas rilis disepakati.
- [ ] Mockup alur utama diperiksa pengguna.
- [ ] PRD versi siap bangun disetujui Anton.

### MVP selesai

- [ ] Seluruh kebutuhan P0 dalam cakupan pilot dijalankan dan diuji, bukan sekadar tampilan demo.
- [ ] Uji negatif, akses tidak sah, perubahan data dan pemulihan tugas lulus.
- [ ] Paket serta polygon benar-benar diekspor dan diverifikasi.
- [ ] Kandidat rencana dibuat dari data nyata, diuji terhadap kriteria yang disetujui, dan tidak disajikan sebagai bidang hak, hasil survei, atau jaminan penerimaan OSS.
- [ ] Operator dapat menyelesaikan alur pilot dengan pencatatan hasil eksternal.
- [ ] Tidak ada temuan kritis keamanan atau integritas data yang belum ditangani.
- [ ] Backup dan pemulihan diuji.
- [ ] Panduan kerja dan batas kemampuan tersedia.
- [ ] Hasil pilot serta biaya aktual dibahas; penerimaan dicatat Anton.

## 18. Riwayat dan batas dokumen

- v0.1: draf awal berdasarkan diskusi visi dan usulan arsitektur; versi asli dipertahankan.
- v0.2: memasukkan usulan Anton tentang peta Sulawesi Tenggara dan filter KBLI; meninjau ulang penundaan pencarian zona pada v0.1. Aturan tampilan, prioritas dan cakupan data di versi ini tetap usulan; belum ada inventaris RDTR provinsi, validasi pemetaan atau pembangunan peta. Q-01 sampai Q-15 belum seluruhnya terjawab.
- v0.3: mengoreksi tujuan sesuai Anton: rekomendasi lokasi dan polygon rencana berbasis kriteria merupakan kebutuhan inti; ketersediaan/realisasi bukan prasyarat rekomendasi. Menambahkan luas, jalan, tutupan, kriteria wajib/preferensi, kandidat berperingkat, ketidakpastian dan pemisahan gerbang pengajuan. Belum ada lokasi nyata/polygon yang dibuat atau dievaluasi. Q-16 sampai Q-20 menambahkan parameter terbuka.
- v0.4: merekam pilot pilihan Anton dan hasil pembacaan awal katalog OSS serta metadata/kegiatan RDTR keempat kabupaten. Belum ada kandidat atau polygon dibuat, belum ada klaim kesesuaian per bidang. Parameter rubrik agronomi/teknis masih perlu disepakati.
- v0.5: menetapkan jawaban Anton bahwa kedekatan jalan hanya preferensi, memperbarui persyaratan/status pertanyaan/uji terkait, dan menjabarkan tahap audit data–rubrik–mockup–persetujuan development. Tidak ada audit geometri/ITBX atau kandidat baru pada revisi ini.
- v0.6: merekam izin kelanjutan, format SHP ZIP + KML, audit geometri/sampel ITBX, inventaris sumber, rubrik usulan dan mockup teruji; karantina geometri invalid dan parameter terbuka dipertahankan. Tidak ada kandidat lahan atau persetujuan resmi yang dinyatakan selesai.
- v0.7: menindaklanjuti arahan Anton: eksplorasi hanya KBLI/wilayah; luas dan parameter kandidat dikeluarkan dari tampilan, validasi serta konfigurasi. Kebutuhan polygon tetap pada modul terpisah; sorotan zona belum diimplementasikan.
- v0.8: merekam implementasi dan pembuktian 20 polygon sumber Tirawuta, API lokal/validator serta 18 pemeriksaan browser; menambahkan UAT-41/42. Seluruh sorotan masih unreviewed/unknown; exact-KBLI, agronomi, kandidat/generator dan OSS tidak dinyatakan selesai.
- v0.9: menindaklanjuti permintaan filter seluruh kabupaten/kota: 17 pilihan, kontrol massal/draf/reset dan namespace ID eksplisit; D-12 serta UAT-43. Sebanyak 32 pemeriksaan browser lulus termasuk setiap wilayah; cakupan geometri, pilot kandidat dan ketidakpastian tidak diperluas secara semu.
- v0.10: memperluas eksplorasi ke snapshot 18 rencana/17 wilayah, dengan 16 calon relasi kegiatan dan celah yang eksplisit; D-13, F-38 sampai F-40 serta UAT-44 sampai UAT-46. Identitas/cache/provenance per rencana, konfigurasi skema 3 dan akses keyboard seluruh fitur menjadi kontrak. Baseline 5.994 polygon bukan izin; seluruh produk dan penerimaan OSS tetap belum selesai.
- Referensi resmi di bawah mendukung konteks tertentu saja, bukan pemeriksaan hukum menyeluruh atau verifikasi operasional OSS.
- Sumber regulasi, katalog dan antarmuka perlu diperiksa ulang saat discovery dan sebelum produksi.
- Langkah berikutnya: review mockup/parameter → validasi aturan/data lanjutan → finalisasi PRD serta desain teknis/backlog → persetujuan development mesin produksi. Tidak ada komitmen biaya atau waktu yang dianggap telah disetujui melalui draf ini.

## Sources

[1] https://jdih.bkpm.go.id/id/document/peraturan-pemerintah-nomor-28-tahun-2025-tentang-penyelenggaraan-perizinan-berusaha-berbasis-risiko
[2] https://www.bps.go.id/id/news/2026/04/27/897/bps-rilis-tabel-konversi-klasifikasi-baku-lapangan-usaha-indonesia-kbli-2020-2025-.html
[3] https://s3.oss.go.id/oss/cms/Panduan-KKPR-RDTR-64228d32a31f5fb25e0985b4f25b1496.pdf
[5] https://oss.go.id/id/kbli/konversi
[6] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7411000000
[7] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7401000000
[8] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7402000000
[9] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/rdtr/7405000000
[10] https://oss.go.id/id/kbli/detail/9f8bd843-df47-5b3d-8794-66a7d1be75b3
[11] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7411000000&id_rtr=001
[12] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7411000000&id_rtr=002
[13] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7401000000&id_rtr=001
[14] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7401000000&id_rtr=002
[15] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7402000000&id_rtr=003
[16] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7402000000&id_rtr=002
[17] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7405000000&id_rtr=002
[18] https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/activities?id_wilayah=7405000000&id_rtr=001
