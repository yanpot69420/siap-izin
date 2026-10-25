# Mockup interaktif — eksplorasi lokasi Siap Izin

**Status terbaru:** prototipe eksplorasi zona, mengikuti PRD v0.8 dan arahan Anton. Kriteria hanya KBLI/wilayah; luas, preferensi jalan dan pencarian/pembuatan polygon berada pada modul terpisah. **Sorotan nyata satu RDTR Tirawuta sudah terintegrasi dan diuji: 20 polygon sumber, 18 pemeriksaan browser lulus.** Seluruh sorotan masih relevan untuk ditelaah, bukan kesesuaian exact-KBLI terverifikasi. [Kontrak dan hasil integrasi](zone-overlay.md).

## Menjalankan

Dari root repositori:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-prototype.txt
python tools/dev_server.py --port 8765
```

Buka `http://127.0.0.1:8765/prototype/`. Python 3.11+ dan dependency geometri diperlukan. Hentikan dengan Ctrl+C. Backend lokal hanya bind loopback, tanpa login/kredensial atau AI. Server statis dan `file://` tidak menyediakan API geometri; [rincian API](zone-api.md).

## Komposisi dan alur

Permukaan utama **Explore**: kriteria di kiri, peta dan tab hasil di tengah, batas penilaian di kanan. Warna hijau hutan digunakan untuk tindakan, bukan status kesesuaian bidang. Tipografi Avenir Next/Avenir/Segoe UI memakai font sistem, tanpa layanan font eksternal. Pada layar kecil, kolom ditumpuk.

1. Pilih KBLI `01273` dan satu atau beberapa dari empat kabupaten; tidak ada input luas/preferensi jalan.
2. Tekan **Terapkan kriteria**. Draf tidak otomatis menjadi konfigurasi ekspor. Setelah peta diaktifkan, kriteria memuat ulang irisan sumber pilot; bukan penilaian izin/seluruh bidang.
3. Filter wilayah membatasi inventaris metadata dan menentukan apakah pilot Tirawuta aktif. Sorotan hanya tersedia jika Kolaka Timur dipilih; tidak membuat batas administratif atau menafsirkan wilayah tanpa data sebagai dilarang.
4. **Muat peta publik** meminta dependensi/tile eksternal dan memicu API lokal untuk sumber geometri resmi. Peta melakukan fit-bounds ke polygon sumber yang valid, bukan batas kabupaten rekaan. API gagal tidak diganti overlay contoh.
5. Tab **Zona** memuat daftar polygon relevan untuk ditelaah; klik peta/daftar membuka ID, dasar filter, atribut peraturan, provenance dan ketidakpastian. Biru putus-putus bukan izin. Tab **Bukti RDTR** tetap memuat delapan nama rencana aktual dari discovery; tujuh rencana lain masih metadata saja.
6. Bukti tiap rencana menampilkan identitas sumber, calon relasi kegiatan lokal yang **belum direview**, unknown, tautan katalog dan daftar kegiatan. Wolo memiliki peringatan eksplisit bahwa kemunculan katalog bukan bukti integrasi/siap pengajuan.
7. Panel hanya membahas **kegiatan/zona** dan bukti. Agronomi serta preferensi jalan tidak menjadi kriteria eksplorasi; kebutuhan tersebut tetap berada pada modul kandidat yang terpisah.
8. Ekspor hanya **JSON konfigurasi eksplorasi**, `schemaVersion: 2`, `artifactType: zone-exploration-configuration`, `module: zone-exploration`, `containsGeometry: false`. Tidak memuat `targetAreaM2`, `areaTolerance`, `road` atau jumlah kandidat. Kontrol ekspor GIS tidak ditampilkan dalam eksplorasi.

Tidak ada pencocokan izin berdasarkan kesamaan istilah atau nama zona. Ada polygon **sumber RDTR untuk tampilan**, tetapi tidak ada koordinat kandidat/bidang proyek, skor kecocokan, kelas agronomi S1/S2/S3 atau probabilitas izin. Kelompok kegiatan lokal `041` belum merupakan relasi exact-KBLI yang ditinjau. Geometri tampilan tidak menjadi berkas rencana atau bukti hak.

## Dependensi publik, atribusi dan jaringan

Seluruh aset aplikasi lokal kecuali peta yang dimuat secara opt-in:

- Leaflet **1.9.4** CSS dan JS: `https://unpkg.com/leaflet@1.9.4/dist/` dengan SRI dan `crossOrigin` sesuai panduan resmi.
- Tile: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, hanya area tampilan aktif. Tidak ada prefetch massal, unduhan offline, proxy atau pengarsipan tile.
- Atribusi **© OpenStreetMap contributors** selalu tampak di peta; tautan lisensi disertakan. Referrer policy `strict-origin-when-cross-origin` tidak meniadakan Referer. Cache browser normal tidak dibypass oleh aplikasi.
- Pemberitahuan UI menjelaskan IP, referer dan area tampilan dapat diketahui penyedia peta. Nilai formulir tidak dikirim ke penyedia tile. Backend memanggil endpoint publik GISTARU tetap untuk pilot setelah peta dimuat; tidak memakai sesi akun pengguna. Tautan OSS bukan pengajuan atau integrasi akun.
- Jika CDN, tile, atau waktu tunggu gagal: tampil pesan kegagalan; tidak ada peta hasil pengganti. Formulir, bukti lokal dan ekspor konfigurasi tetap berfungsi. Gagal CDN memiliki tombol coba ulang; kegagalan tile dapat dipulihkan dengan memuat ulang halaman setelah jaringan pulih.

Panduan resmi dibaca melalui browser pada 25 Oktober 2026:

- `https://leafletjs.com/examples/quick-start/`: urutan CSS/JS, versi/pin/SRI, container berukuran, URL tile dan atribusi.
- `https://operations.osmfoundation.org/policies/tiles/`: URL HTTPS, atribusi terlihat, Referer, cache browser, larangan bulk/offline serta layanan best-effort tanpa SLA.

Jalur ekstraksi teks web gagal karena backend ekstraksi tidak tersedia; verifikasi diselesaikan lewat browser pada halaman resmi. Pemeriksaan ini bukan persetujuan penggunaan untuk produksi atau publikasi ulang data resmi. Tidak ada geodata mentah resmi yang disertakan.

## Kontrak opsional ringkasan audit

Berkas: `prototype/audit-summary.json`. Kini berisi delapan ringkasan turunan tersanitasi dari [audit sumber](../discovery/rdtr-geometry-audit.md), tanpa geometri/koordinat mentah. Bentuk kosong yang tetap didukung:

```json
{"schemaVersion":1,"checkedAt":null,"plans":[]}
```

Penggantian isi hanya boleh memakai ringkasan audit **turunan tersanitasi**, bukan snapshot mentah/geometri. Setiap elemen `plans` memakai:

| Field | Kontrak |
|---|---|
| `id` | Salah satu ID tepat pada tabel di bawah; unik |
| `summary` | String ringkasan faktual nonkosong, maksimum 4000 karakter; wajib |
| `reviewStatus` | String status review opsional, ditampilkan apa adanya sebagai status ringkasan, bukan keputusan kegiatan/lokasi |
| `unknowns` | Array string opsional; setiap string maksimum 1000 karakter |
| `checkedAt` (root) | String waktu pemeriksaan sumber opsional atau null; bukan tanggal render halaman |

| ID | Rencana |
|---|---|
| `7411000000:001` | RDTR Kawasan Perkotaan Tirawuta |
| `7411000000:002` | RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo |
| `7401000000:001` | RDTR Kawasan Perkotaan Kolaka |
| `7401000000:002` | RDTR Kawasan Perkotaan Wolo |
| `7402000000:003` | RDTR Wilayah Perencanaan Routa |
| `7402000000:002` | RDTR Pondidaha |
| `7405000000:002` | RDTR Wilayah Perencanaan Laonti |
| `7405000000:001` | RDTR Wilayah Perencanaan Angata |

Loader gagal aman untuk berkas tidak tersedia, JSON rusak, versi berbeda, ID tidak dikenal, ID duplikat atau ringkasan tidak valid; metadata discovery tetap tersedia. Semua teks audit dirender dengan `textContent`, bukan HTML. Field lain tidak dipakai; kontrak tidak menerima kandidat, geometri atau skor dan tidak mengaktifkan ekspor GIS. Jangan memasukkan data sensitif, raw geodata, klaim verifikasi tanpa bukti, maupun informasi yang belum boleh dipublikasikan. Ringkasan tambahan ditampilkan di dialog rencana terkait; status utama tetap belum dinilai karena mockup tidak mengevaluasi bidang.

## Verifikasi baseline v0.6 — historis

Bagian hasil awal dan integrasi di bawah mendokumentasikan baseline sebelum pemisahan modul. Kasus input/validasi luas, preferensi jalan dan ekspor GIS yang disebut di sana **tidak lagi menjadi perilaku modul eksplorasi v0.7**. [Rekaman regresi terbaru](exploration-verification.json) membuktikan perubahan dari RED ke GREEN, dengan 12 assertion browser lulus: field/ringkasan luas dihapus, kriteria hanya KBLI/wilayah, konfigurasi v2 tanpa parameter kandidat, penerapan tanpa luas, penolakan KBLI/wilayah kosong, filter, reset, pratinjau JSON serta tidak ada exception JavaScript tertangkap. Pengujian ini tidak membuktikan sorotan zona berfungsi.

Pembuktian sorotan v0.8 berbeda dari angka historis di bawah: [18 pemeriksaan browser](zone-overlay-verification.json) memeriksa lapisan nyata, klik interior sumber, perubahan filter, respons rusak/terlambat, unduhan, keyboard/seluler dan pemulihan CDN. Jangan menjumlahkan sesi berbeda sebagai kasus unik atau menganggap rendering membuktikan penerimaan OSS.

Tanggal sesi: **25 Oktober 2026**, waktu lokal WITA. Browser Chromium melalui browser harness/CDP, tanpa membaca auth/session atau cookie. Resolusi desktop **1512×1100**, seluler **390×844**.

`prototype/test-output/results.json` merekam hasil aktual. **22 pemeriksaan lulus**:

- Default delapan sumber dan GIS nonaktif.
- Filter Kolaka menjadi dua metadata tanpa menciptakan kandidat.
- Detail Wolo, peringatan, dan dua tautan sumber.
- Tanpa wilayah ditolak tanpa auto-select.
- KBLI kosong ditolak.
- Luas nol ditolak validasi HTML browser.
- Konfigurasi terapan 6500 m²/tanpa preferensi jalan, tetap nol kandidat dan tanpa geometri.
- Tombol unduh benar-benar menghasilkan JSON; berkas dibaca ulang dan isinya diperiksa.
- GIS tetap nonaktif dengan alasan.
- Tidak ada galat JavaScript pada alur utama.
- Seluler 390 px tanpa overflow horizontal.
- Navigasi tab menggunakan ArrowRight.
- Dialog ditutup menggunakan Escape.
- CDN diblokir melalui CDP: pesan gagal dan tombol coba lagi, bukan hasil palsu.
- Tile diblokir melalui CDP: status kegagalan tampil, tidak ada marker kandidat.
- Tidak ada galat JavaScript pada skenario kegagalan jaringan (kegagalan resource terblokir memang diharapkan).
- Empat pemeriksaan tambahan menguji setiap kabupaten secara terpisah: masing-masing tepat dua metadata, tanpa kandidat.
- Atur ulang mengembalikan 5000 m² dan empat kabupaten.
- Peta publik nyata berhasil dimuat dengan atribusi terlihat.

Pada pengujian awal, peta publik benar-benar dimuat: **15 tile** berhasil, status sukses dan atribusi terlihat. `node --check prototype/app.js` lulus. Ini bukan pengujian GIS, overlay ITBX, unggah OSS, atau penerimaan browser lintas vendor. Pengujian awal memakai ringkasan kosong; hasil integrasi ringkasan faktual dicatat terpisah setelah penyatuan.

### Uji integrasi ringkasan audit

Setelah delapan ringkasan faktual diisi dan format ekspor diselaraskan, **20 pemeriksaan integrasi lulus**. Hasil ringkas yang portabel ada pada [rekaman verifikasi UI](ui-verification.json); hasil mentah tambahan lokal ada di `prototype/test-output/integration-results.json`.

- Delapan ringkasan terbaca; tiap filter kabupaten tetap dua entri, nol kandidat, GIS nonaktif.
- Dialog Wolo memuat 728 fitur sumber, satu invalid, batas sampling dan ketidakpastian; bukan penilaian bidang.
- Wilayah kosong/luas nol ditolak tanpa merusak konfigurasi terapan.
- JSON mempertahankan kode `01273`, scope belum dikonfirmasi, toleransi null dan jalan tanpa cutoff.
- Fixture uji versi salah, ID tak dikenal dan ID duplikat ditolak dengan fallback jujur. Fixture hanya menguji loader; bukan data lokasi dan tidak ditulis ke ringkasan terbitan. Setelah uji, delapan ringkasan nyata dibaca ulang.
- Navigasi tab keyboard, seluler 390 px dan desktop diuji; tidak ada overflow horizontal atau galat JavaScript.
- Peta nyata memuat 15 tile dengan atribusi. Unduhan konfigurasi 5000m2 benar-benar dihasilkan dan dibaca ulang; bukan polygon.

Sesi awal 22 pemeriksaan dan sesi integrasi 20 pemeriksaan berjumlah 42 assertion, **bukan 42 kasus unik** karena sebagian alur diulang. Pemeriksaan fixture pertama sempat terhenti karena sintaks dalam harness uji; sintaks uji diperbaiki dan seluruh sesi integrasi dijalankan kembali. Ini tidak mengubah status rubrik atau UAT GIS/OSS.

### Bukti tangkapan layar

Path berikut relatif terhadap root repo, merupakan bukti uji **lokal**, dan tidak ikut commit repo publik. Laporan ini tetap menyertakan hasil dan cara menjalankan mockup:

- `prototype/test-output/desktop-map.png`
- `prototype/test-output/evidence-wolo.png`
- `prototype/test-output/export-disabled.png`
- `prototype/test-output/mobile-top.png`
- `prototype/test-output/mobile-map.png`
- `prototype/test-output/map-network-failure.png`
- `prototype/test-output/tile-network-failure.png`
- `prototype/test-output/integrated-desktop-map.png`
- `prototype/test-output/integrated-evidence-wolo.png`

Unduhan uji: `prototype/test-output/siap-izin-konfigurasi-pencarian.json` adalah artefak **uji konfigurasi** 6500 m², bukan perubahan default pilot 5000 m², bukan hasil proyek atau polygon. Jangan menyebutnya berkas GIS.

Audit visual: komposisi Explore tanpa hero pemasaran, angka metrik rekaan, gradient, glassmorphism atau kartu fitur generik. Font sistem dipilih untuk portabilitas dan keterbacaan dashboard lokal. Fokus keyboard, label teks dan status tidak hanya bergantung warna. Keterbatasan: desktop cukup padat, seluler membutuhkan gulir panjang; belum ada pengujian pembaca layar menyeluruh atau lintas browser.

## Berkas dan batas pekerjaan

- `prototype/index.html`, `prototype/styles.css`, `prototype/zones.css`, `prototype/app.js`, `prototype/zone-data.js`: antarmuka/validator tanpa framework.
- `tools/dev_server.py`, `requirements-prototype.txt`: backend lokal dan dependency geometri; cache privat tidak disajikan.
- `tests/test_zone_server.py`, `tests/zone-data.test.cjs`: tes offline backend dan kontrak browser, bukan data peta contoh.
- `prototype/audit-summary.json`: delapan ringkasan audit turunan, bukan data geometri atau hasil lokasi.
- `prototype/test-output/`: bukti uji aktual dan unduhan konfigurasi lokal, diabaikan Git.
- `docs/design/mockup.md`: dokumentasi ini.

Mockup tidak melakukan deploy atau tindakan pada OSS dan bukan persetujuan pembangunan mesin produksi. Kandidat nyata, pemeringkatan, generator polygon, implementasi rubrik serta kontrak ekspor GIS tetap di luar hasil pekerjaan ini. Dokumen induk diselaraskan pada tahap integrasi, bukan menganggap seluruh kebutuhan telah selesai.
