# Filter seluruh kabupaten/kota Sulawesi Tenggara

## Cakupan dan perilaku

Permintaan Anton memperluas **filter eksplorasi** ke seluruh Sulawesi Tenggara: **15 kabupaten dan 2 kota**. Ini tidak memperluas pilot kandidat/agronomi empat kabupaten atau mengaktifkan geometri seluruh provinsi secara otomatis.

- Tersedia 17 pilihan, urut alfabetis per kabupaten lalu kota. Semua terpilih pada awal halaman dan setelah **Atur ulang**.
- **Pilih semua** dan **Kosongkan** mengubah draf saja; hasil peta dan konfigurasi terapan tidak berubah sebelum **Terapkan kriteria**.
- Setidaknya satu wilayah wajib dipilih. Pilihan kosong ditolak tanpa merusak hasil terapan sebelumnya.
- Daftar dapat digulir dan digunakan dengan keyboard; jumlah pilihan ditampilkan.
- Judul/ringkasan menyebut kabupaten/kota, bukan menganggap kota sebagai kabupaten atau selalu melabeli wilayah sebagai Tirawuta.
- Inventaris delapan RDTR masih berasal dari empat kabupaten awal. Pilihan tanpa inventaris menampilkan ketidaktersediaan bukti, **bukan** kesimpulan tidak ada RDTR atau kegiatan dilarang.
- Sorotan geometri tetap hanya Tirawuta. Jika Kolaka Timur tidak dipilih, lapisan dibersihkan dan peta kembali ke viewport regional, tanpa menggambar batas atau zona rekaan.
- Ekspor memuat wilayah yang sudah diterapkan, bukan draf. Tetap tanpa luas, preferensi jalan atau geometri.

## Identitas wilayah dan sumber

Nama seluruh 17 wilayah dicocokkan dengan tabel publik Kemendikdasmen yang dibaca melalui HTTPS dengan HTTP 200 pada 25 Oktober 2026:

`https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/200000/1/jf/all/s1`

Nama tampil memakai prefiks Kabupaten; sumber tersebut menulis `Kab.` dan `Kota Bau Bau`, sedangkan aplikasi menampilkan `Kota Baubau`. Variasi nama tampil ini tidak digunakan untuk menebak ID GISTARU atau menyamakan kode antarinstansi.

Endpoint publik GISTARU yang dibaca pada sesi yang sama:

`https://gistaru.atrbpn.go.id/rdtrinteraktif/api/interactive/cities/7400000000`

Respons HTTP/application 200 mengembalikan **11 entri**, bukan daftar administratif lengkap 17 wilayah. Seluruh pasangan ID/nama dari 11 entri direkonsiliasi dengan katalog aplikasi. Untuk enam wilayah lainnya, aplikasi memakai kunci internal eksplisit `local:sultra:*`, dengan `gistaruId: null` dan `idNamespace: internal`. Ini bukan kode resmi, bukan pengganti kode BPS/Kemendagri dan bukan bukti tidak adanya RDTR. Tidak ada permintaan geometri yang dibentuk dari kunci internal.

| Nama tampil | ID aplikasi | Namespace |
|---|---|---|
| Kabupaten Bombana | `7406000000` | GISTARU |
| Kabupaten Buton | `7404000000` | GISTARU |
| Kabupaten Buton Selatan | `local:sultra:buton-selatan` | Internal; ID GISTARU belum terpetakan |
| Kabupaten Buton Tengah | `7414000000` | GISTARU |
| Kabupaten Buton Utara | `local:sultra:buton-utara` | Internal; ID GISTARU belum terpetakan |
| Kabupaten Kolaka | `7401000000` | GISTARU |
| Kabupaten Kolaka Timur | `7411000000` | GISTARU |
| Kabupaten Kolaka Utara | `local:sultra:kolaka-utara` | Internal; ID GISTARU belum terpetakan |
| Kabupaten Konawe | `7402000000` | GISTARU |
| Kabupaten Konawe Kepulauan | `7412000000` | GISTARU |
| Kabupaten Konawe Selatan | `7405000000` | GISTARU |
| Kabupaten Konawe Utara | `7409000000` | GISTARU |
| Kabupaten Muna | `local:sultra:muna` | Internal; ID GISTARU belum terpetakan |
| Kabupaten Muna Barat | `local:sultra:muna-barat` | Internal; ID GISTARU belum terpetakan |
| Kabupaten Wakatobi | `7407000000` | GISTARU |
| Kota Baubau | `local:sultra:baubau` | Internal; ID GISTARU belum terpetakan |
| Kota Kendari | `7471000000` | GISTARU |

Katalog kurasi ringan berada di `prototype/region-data.js`; tidak memuat batas/geometri, token atau sesi. Konfigurasi eksplorasi skema v2 kini menambahkan `idNamespace` dan `gistaruId` pada setiap wilayah. Konsumen tidak boleh menganggap semua `id` sebagai kode GISTARU atau mengirim kunci internal ke layanan resmi. Snapshot mentah sumber, harness dan screenshot tetap di luar publikasi repo.

## Verifikasi nyata

- Test katalog dan reproduksi browser diperlihatkan **RED** sebelum implementasi, lalu **GREEN**.
- **2 test Node** lulus: katalog wilayah dan kontrak geometri yang sudah ada. **11 test backend offline** kembali lulus; backend tidak diperluas menjadi proxy umum.
- **32 pemeriksaan browser lulus**, termasuk setiap satu dari 17 wilayah secara individual, pilihan campuran kota/kabupaten, default/reset, pilih semua/kosongkan, draf versus terapan, penolakan kosong, keyboard, gulir/seluler, dan unduhan JSON yang benar-benar dibaca ulang.
- Tanpa Kolaka Timur tidak ada polygon lama yang tampil. Setelah reset, **20 polygon sumber Tirawuta** kembali tampil dengan hitungan layer yang cocok dan status izin tetap unknown.
- Tidak ada exception JavaScript tertangkap. Desktop 1512×1100 dan seluler 390×844 tanpa overflow horizontal.

[Rekaman hasil portabel](region-filter-verification.json). Ini bukan uji seluruh RDTR provinsi, pemetaan exact-KBLI, batas administratif, agronomi atau pengajuan OSS. Hasil historis sorotan pada [laporan sebelumnya](zone-overlay.md) tetap merupakan bukti versi sebelumnya; jangan menjumlahkan sesi berbeda sebagai kasus unik.
