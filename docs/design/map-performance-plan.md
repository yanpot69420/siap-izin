# Optimasi peta — urutan kerja dan kontrak keselamatan

**Persetujuan:** Anton meminta pelaksanaan urutan yang direkomendasikan: (1) baseline dan sorotan, (2) geometri tampilan ringan serta perbandingan SVG/Canvas, (3) pemuatan area/zoom, vector tiles hanya bila hasil pengukuran masih memerlukan. Bukan izin mengganti geometri analisis atau mengubah status izin.

Permukaan tetap **Explore**: filter wilayah/KBLI, peta, daftar dan pemeriksaan sumber. Tidak menambahkan luas, agronomi, jalan atau kandidat.

## Tahap 1 — ukur, lalu rapikan

- Ukur byte respons HTTP, kompleksitas geometri, waktu request/JSON/render, kesiapan overlay, long task, heap dan skenario geser/zoom yang dapat diulang. Bedakan ukuran file cache dari byte HTTP dan waktu gambar dari waktu sumber jaringan.
- Baseline renderer memakai kode checkpoint `d72e21a`. Gunakan profil Chromium terisolasi dan tiga pengulangan pada viewport yang sama. Replay sumber yang disimpan untuk pembandingan terkontrol wajib diberi label benchmark/cached_snapshot dan mempertahankan waktu asli; tidak menjadi fallback produksi atau disebut pembacaan live.
- Sorotan overview: isian biru tipis tanpa garis internal yang dominan. Pada zoom regional/detail batas mulai terlihat. Pilihan/hover lebih tegas; bukan semua polygon bergaris putus-putus tebal.
- Legenda, teks unknown dan panel detail tetap menyatakan relevansi, bukan izin. Basemap tetap penyedia lama agar tidak menambah kebijakan/layanan; penetralan kontras hanya CSS lokal pada pane basemap, tidak menyembunyikan atribusi.

## Tahap 2 — geometri tampilan, bukan geometri analisis

Uji baca-saja terhadap sumber tersimpan menunjukkan kandidat terbesar, Routa, mempunyai 1.877.978 verteks. Dengan coverage simplification pada toleransi 100/10/1 meter, hasil percobaan masing-masing 11.085/29.691/111.475 verteks; semua 1.688 fitur tetap valid/tidak kosong dan coverage valid pada percobaan tersebut. Ini pengukuran geometri, **bukan** hasil loading browser yang sudah lebih cepat.

Ada rencana yang polygon-nya valid per fitur tetapi tidak membentuk coverage dengan edge-matching/non-overlap yang valid. Jangan menjalankan coverage simplification pada kelompok tersebut: pertahankan geometri sumber untuk rencana/level terkait, beri metadata alasan dan ukur dampaknya. Jangan repair, menutup gap, dissolve atau menghilangkan fitur diam-diam.

- Tiga level tetap untuk prototipe: overview100m, regional10m, detail1m; ukur di CRS meter yang cocok, kembalikan WGS84 untuk tampilan. Pemilihan toleransi adalah parameter implementasi tampilan, bukan ketelitian bidang.
- Untuk coverage yang valid, gunakan operasi coverage-aware dan validasi kembali seluruh output: ID sama, jumlah fitur sama, tipe polygon, tidak kosong, topologi/coverage valid. Jika gagal, level tersebut mempertahankan sumber asli secara eksplisit.
- Simpan turunan terpisah, terikat hash konteks/snapshot sumber dan versi algoritma. Jangan mengubah file sumber/cache asli. Turunan tidak masuk analisis luas, overlay bidang, SHP/KML atau klaim hak.
- Pisahkan atribut minimal untuk peta/daftar dari detail. Detail diminta menurut pasangan planId/OID dan ID snapshot; perubahan snapshot harus menghasilkan konflik/reload, bukan detail dari snapshot lain.
- Bandingkan SVG dan Canvas dengan data, viewport dan skenario sama setelah baseline tersedia. Pilih hasil pengukuran, bukan asumsi bahwa Canvas selalu menang. Akses detail melalui daftar/keyboard tetap wajib walau canvas tidak memiliki satu elemen DOM per polygon.

## Tahap 3 — area dan zoom

- Katalog18rencana/17wilayah tetap ringan dan selalu dapat ditelusuri. Muat overview ringan untuk inventaris geometri dan informasi batas sumber, lalu prioritaskan tingkat detail hanya untuk rencana yang berpotongan dengan area peta.
- Setelah geser/zoom selesai, debounce request, maksimal3serentak, batalkan dan abaikan revisi lama. Jangan melakukan fit-bounds berulang pada respons viewport sehingga peta melompat atau memicu loop pemuatan.
- Bbox menyaring fitur sumber; tidak boleh dianggap batas cakupan atau bidang proyek. Polygon yang diminta tetap mempertahankan ID asal. Semantik hasil viewport dijelaskan terpisah dari seluruh fitur tersedia.
- Daftar seluruh fitur sumber tetap dapat ditelusuri dengan keyboard; memilih fitur di luar layar memindahkan peta/meminta level yang tepat, bukan menghilangkan aksesnya.
- Bedakan hitungan katalog, sumber tersedia, overview dimuat, dan fitur dalam layer tampilan. Hasil kosong pada suatu viewport bukan tidak ada zona dalam seluruh kabupaten.
- Vector tiles/MapLibre hanya dipilih jika setelah langkah ini payload/render/geser-zoom masih menjadi hambatan terukur. Penundaan tile bukan klaim implementasi tile sudah selesai.

## Kontrak teknis yang harus dibekukan sebelum integrasi

API lama `/api/zones` tetap sebagai kontrak sumber asli dan tes regresi; antarmuka dioptimasi tidak boleh diam-diam memakai endpoint penuh saat endpoint turunan gagal. Endpoint turunan harus allowlisted per rencana/KBLI dan enum level, memvalidasi bbox dan ID numerik secara ketat, bukan proxy umum.

Metadata baru wajib memisahkan `sourceCounts` dari hitungan hasil tampilan/viewport. Seluruh fitur tetap `permission:unknown` dan `evidence_status:unreviewed_mapping`. Metadata turunan mencakup level, metode, toleransi meter, status validasi/fallback asli, ID snapshot dan waktu/status sumber. Perubahan kontrak klien harus diuji fail-closed, termasuk detail snapshot salah dan payload yang menyelundupkan geometri ke konfigurasi.

Rincian nama endpoint/field akan diselaraskan antara backend dan frontend setelah baseline, sebelum ownership implementasi dibagi. Tidak ada target percepatan persentase atau detik yang dinyatakan tercapai sebelum benchmark pembanding benar-benar dijalankan.

## Gerbang selesai

- Baseline dan hasil optimasi dapat direproduksi dengan dataset dan kondisi yang disebutkan.
- Seluruh16rencana terpetakan diperiksa untuk identitas/count/validitas output;5.994fitur tetap tercatat,15invalid sumber tidak kembali digambar.
- Styling/LOD/viewport, zoom/pan, klik/keyboard/sentuhan, detail sumber, celah6wilayah/2relasi, partial/error/abort, perubahan kriteria dan unduhan konfigurasi diuji nyata.
- Tidak menyimpulkan izin, tidak mengubah geometri asli, tidak mempublikasikan raw geodata/replay.
- Review independen dan verifikasi GitHub setelah publikasi. PRD dan bukti versi sebelumnya tetap diperlakukan sebagai checkpoint historis.
