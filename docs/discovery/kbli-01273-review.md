# Review bukti terbatas — KBLI 01273 / 2025

**Tanggal review: 29 Oktober 2026. Hanya satu KBLI: `01273` / `2025`.**
**Hasil: klasifikasi terverifikasi; pemetaan lokal belum direview; ketentuan lengkap belum tersedia untuk keputusan; izin seluruh bidang dan penerimaan OSS tidak diketahui.** Ini review bukti, bukan approval pemetaan/izin, bukan pencarian kandidat, bukan audit provinsi baru.

## 1. Klasifikasi resmi dan batas scope

Publikasi resmi BPS dirilis 24 Desember 2025, dengan metadata revisi 13 Januari 2026.[1] PDF berhasil diunduh dari tautan resmi publikasi, 1040 halaman; **halaman tercetak 244 = halaman PDF 260 (penomoran mulai 1)** memuat `01273` Pertanian Kakao.[2] Cakupannya meliputi rangkaian pertanian dari pengolahan lahan, penanaman, pemeliharaan hingga panen dan pascapanen, serta penanaman kakao penghasil benih berupa biji.[2] Tidak digunakan sebagai pembenaran mengganti kegiatan menjadi industri atau perdagangan.

Halaman OSS yang benar-benar dibaca menampilkan KBLI 2025 `01273`, uraian kakao, dua ruang lingkup terpisah produksi benih dan budidaya, serta keterangan konversi 01270 menjadi 01273.[3] Keterangan katalog bukan pembuktian penerimaan proyek target. **Pengguna belum mengonfirmasi pilihan budidaya atau produksi benih.** Halaman juga memuat catatan campuran kopi/teh/kakao; batas luas atau kewajiban dari catatan tersebut tidak ditranskripsi menjadi aturan mesin.[3]

## 2. Amendemen: PDF operatif diperoleh melalui alternatif primer

Halaman resmi JDIH mengidentifikasi Peraturan BPS 6/2026 sebagai perubahan 7/2025, dengan penetapan 4 September 2026 dan pengundangan 10 September 2026.[4] Tautan halaman itu mengandung elipsis literal dan tidak direkonstruksi. Setelah kendala awal, parent memperoleh PDF lengkap dari **peraturan.go.id dan JDIH BPK**, keduanya 3.341.286 byte dengan SHA-256 identik.[5][6]

**Pasal I mengganti lampiran**, sehingga pembuktian tidak cukup berhenti pada abstrak. Entri `01273` pada **lampiran halaman tercetak 11** telah dibaca: tetap Pertanian Kakao, mencakup rangkaian pertanian hingga pascapanen serta penanaman penghasil benih berupa biji.[5][6] Status kini `verified_01273_entry_in_amended_annex`; ini hanya verifikasi entri 01273 pada lampiran operatif, bukan perbandingan seluruh kode, kepastian tidak ada perubahan hukum berikutnya, atau approval kegiatan/zona/OSS.

SHA-256 PDF amendemen: `94732a0cd46a416f27a888e355d78cf96fae586359d3ddac37b121de8a513b28`. Kedua file mentah tetap privat.

URL PPID yang menjadi lead mengembalikan HTML verifikasi, bukan PDF. Alternatif primer berhasil: tombol unduh pada publikasi BPS.[1][2] SHA-256 PDF yang diterima:

`169ec324af12c3e535d081dbe3789e019f9131ab81460357c2453fd0651a56b3`

## 3. Review lokal, bukan pengambilan ulang sumber

Sumber lokal yang benar-benar dibandingkan: `docs/discovery/sultra-01273-source-audit.json` dan `tools/rdtr-plans.json`. SHA-256 masing-masing ada di `prototype/evidence-01273.json`. Dokumen `rdtr-geometry-audit.md` dan `pilot-kakao.md` dibaca sebagai riwayat tahap berbeda, bukan ditambahkan ke total audit filter. Review ini tidak memanggil ulang ArcGIS/ITBX, tidak encoder probe, tidak login OSS, tidak menambah kandidat atau geometri.

Snapshot audit bertanggal 25 Oktober 2026 UTC (26 Oktober waktu lokal); koreksi Lasalimu dicatat 26 Oktober 2026. Tanggal review tidak menaikkan snapshot menjadi live. Hasil perhitungan ulang lokal: **18 rencana; 16 dengan calon relasi, 2 tanpa relasi; 6009 matched / 5994 returned / 15 excludedInvalid; 32 sampel titik historis.** Seluruh pasangan ID kegiatan dan field filter cocok antara dua berkas lokal. Ini pemeriksaan konsistensi berkas, bukan validasi substantif pemetaan. Audit geometri delapan layer dan 35 titik pada dokumen terdahulu berbeda cakupan dengan audit filter ini; kedua total tidak dijumlahkan.

### Jejak per rencana

Semua baris: exact-KBLI belum direview, ketentuan ITBX lengkap belum direview, izin seluruh bidang tidak diketahui. Angka adalah matched/returned/invalid historis, bukan jumlah lokasi yang disetujui. URL katalog/kegiatan resmi **per rencana**, pointer snapshot, object ID sampel, kode filter, dan checklist tersedia di JSON; URL tersebut disalin dari metadata lokal dan **tidak direvalidasi live**.

| ID rencana | Nama sumber | ID — kegiatan lokal persis | Field | Kode filter sumber | m/r/i | Status relasi |
|---|---|---|---|---|---|---|
| 7401000000:001 | RDTR Kawasan Perkotaan Kolaka | 025 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | PS, RTH-8, EM, P-3, R-4, R-5 | 1054/1054/0 | unreviewed_mapping |
| 7401000000:002 | RDTR Kawasan Perkotaan Wolo | 034 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | R-3, R-4, K-3, P-1, P-2, P-3, W | 254/253/1 | unreviewed_mapping |
| 7402000000:003 | RDTR Wilayah Perencanaan Routa | 043 — Perkebunan Tanaman Aromatik/Penyegaran | KODSZN | P-1, P-2, P-3 | 1688/1688/0 | unreviewed_mapping |
| 7402000000:002 | RDTR Pondidaha | 016 — PERKEBUNAN TANAMAN AROMATIK/PENYEGAR | KODSZN | P-2, P-3 | 197/196/1 | unreviewed_mapping |
| 7404000000:001 | RDTR Kec.Lasalimu | 014 — Pertanian Tanaman Untuk Bahan Minuman | KODSZN | P-2, P-3, R-5 | 182/178/4 | unreviewed_mapping |
| 7405000000:002 | RDTR Wilayah Perencanaan Laonti | 044 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | RTH-1, P-2, P-3, R-3, R-4 | 322/321/1 | unreviewed_mapping |
| 7405000000:001 | RDTR Wilayah Perencanaan Angata | 044 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | RTH-2, P-1, P-2, P-3, R-3, R-4, R-5 | 381/380/1 | unreviewed_mapping |
| 7406000000:001 | RDTR Kawasan Perkotaan Rumbia | 043 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | P-3 | 51/51/0 | unreviewed_mapping |
| 7407000000:002 | RDTR Matahora Sekitar Kawasan Pariwisata | 060 — Pertanian Tanaman untuk Bahan Minimum | KODSZN | P-3 | 58/57/1 | unreviewed_mapping |
| 7407000000:001 | RDTR Perkotaan Wangi-Wangi | 060 — Pertanian Tanaman untuk Bahan Minimum | KODSZN | KR, P-1, P-3, KPI | 72/72/0 | unreviewed_mapping |
| 7407000000:003 | RDTR Kawasan Perktoaan Usuku dan Sekitarnya | 039 — Perkebunan Tanaman Aromatik/Penyegar | KODSZN | HL, P-3, R-4 | 389/383/6 | unreviewed_mapping |
| 7409000000:001 | RDTR Kawasan Perkotaan Wanggudu | tidak tersedia | KODSZN | tidak tersedia | — | unavailable_mapping |
| 7411000000:001 | RDTR Kawasan Perkotaan Tirawuta | 041 — Perkebunan tanaman aromatik/penyegar | KODSZN | P-3 | 20/20/0 | unreviewed_mapping |
| 7411000000:002 | RDTR Kawasan Agropolitan Mowewe, Lalolae, Tinondo | 041 — Perkebunan tanaman aromatik/penyegar | KODSZN | P-2, P-3, R-4, R-5 | 373/373/0 | unreviewed_mapping |
| 7412000000:001 | RDTR Kawasan Perkotaan Langara | 320 — Perkebunan Tanaman Aromatik/Penyegar | KODUNK | HPK.00, HPK.01, HPK.02, P-2.00, P-2.01, P-2.02, P-2.03, P-2.04, P-3.00, P-3.01, P-3.02, P-3.03, P-3.04, P-3.05, P-3.06, P-3.07, P-3.08, P-3.09, P-4.01, P-4.02 | 502/502/0 | unreviewed_mapping |
| 7414000000:001 | RDTR Kawasan Perkotaan Labungkari | 002 — Pertanian Tanaman Tahunan | KODSZN | PS, P-3, KPI, W, R-4, R-5, SPU-1, SPU-2, SPU-3, PL-6 | 346/346/0 | unreviewed_mapping |
| 7414000000:002 | RDTR Kawasan Perkotaan Mawasangka | 043 — Perkebunan Tanaman Aromatik/Penyegaran | KODSZN | RTH-1, RTH-2, RTH-3, RTH-4, RTH-5, P-3, R-3, R-4 | 120/120/0 | unreviewed_mapping |
| 7471000000:001 | RDTR WP I Central Business Districk (CBD) Teluk Kendari | tidak tersedia | KODSZN | tidak tersedia | — | unavailable_mapping |

Langara mempertahankan **KODUNK** dengan sufiks kode, bukan dipaksa ke KODSZN. ID 043 pada rencana berbeda bukan satu identitas global. Ejaan sumber seperti “Bahan Minimum” tetap dipertahankan; bukan pembetulan semantik otomatis. Lasalimu menggunakan **014**, bukan 015, mengikuti koreksi lokal bertanggal 26 Oktober; kesamaan filter tidak memverifikasi exact-KBLI. Tidak ditemukannya kegiatan pada dua rencana berarti relasi belum tersedia, bukan dilarang.

## 4. Checklist praktis satu KBLI

- [x] Tetapkan kode/version sebagai string `01273` / `2025`; tidak memperluas KBLI.
- [x] Ambil klasifikasi primer nyata, periksa judul/uraian, pisahkan nomor halaman cetak/PDF dan simpan hash.
- [x] Baca metadata/abstrak, lalu peroleh PDF penuh amendemen melalui dua sumber pemerintah dan verifikasi entri 01273 pada lampiran operatif.
- [x] Bandingkan setiap identitas rencana, ID/nama kegiatan dan field filter secara lokal; simpan URL sumber dan checksum input.
- [x] Pertahankan status tidak diketahui; jangan mewarnai calon relasi sebagai izin.
- [x] Peroleh PDF penuh 6/2026, baca Pasal I-II serta entri 01273; penelusuran perubahan hukum berikutnya tetap kewajiban terpisah saat penggunaan resmi.
- [ ] Konfirmasi scope proyek kepada pengguna (budidaya atau produksi benih); jangan menganggap pilihan ini sudah terjadi.
- [ ] Untuk setiap rencana, dapatkan crosswalk/penjelasan otoritas yang menghubungkan **01273/2025 + scope** ke **ID kegiatan lokal rencana**, dengan reviewer dan tanggal.
- [ ] Verifikasi peraturan RDTR berlaku, batang tubuh/lampiran tabel ITBX lengkap, legenda I/T/B/X, syarat numerik berbasis blok, pengecualian, overlay dan perubahan. Kode T2 atau judul kategori tidak diterjemahkan bebas.
- [ ] Sebelum kesimpulan bidang, overlay geometri penuh, cakupan/tumpang tindih dan semua syarat; sampel titik tidak cukup.
- [ ] Penerimaan OSS hanya boleh dinyatakan dengan bukti alur/proyek target yang diotorisasi; katalog dan klasifikasi bukan bukti tersebut.
- [ ] Konfirmasi hak pemanfaatan/publikasi ulang sebelum memublikasikan data mentah; review publik ini tidak menyatakan lisensi telah jelas.

## 5. Batas penerimaan dan kontrak paket

**Dapat diterima sekarang:** deliverable review satu KBLI, metadata klasifikasi primer, calon relasi per rencana yang dapat ditelusuri, dan unknowns eksplisit. **Belum dapat diterima:** pemetaan final, seluruh ITBX tervalidasi, status izin seluruh polygon, kelayakan unggah atau persetujuan OSS. Tidak ada ukuran sampel yang mengubah batas ini tanpa bukti otoritas.

`prototype/evidence-01273.json` adalah skema bukti mandiri `siap-izin.public-evidence-01273.v1`, bukan migrasi schema aplikasi. Field top-level allowlist: schemaId, reviewDate, scope, claimStatus, classification, amendment, sources, localProvenance, historicalSummary, plans, acceptanceBoundary. Konsumen wajib menolak field tak dikenal; kode/version/scope berubah membatalkan asumsi review. Paket tidak memuat geometri/koordinat, cookie, sesi, header, informasi klien, konfigurasi DB, atau blob PDF. Hanya URL publik dan metadata bukti; dokumen mentah disimpan privat di luar repo. Integrasi frontend/server tidak dilakukan pada tugas ini.

Per rencana, checklist berisi pembandingan snapshot yang sudah dilakukan serta crosswalk otoritas, peraturan/ITBX lengkap, overlay seluruh bidang dan penerimaan target yang seluruhnya masih false. Status `verified_classification` tidak menular ke status relasi/izin. `unavailable_full_rules` berarti bukti penuh belum direview dalam tugas ini, **bukan klaim aturan tersebut tidak ada**.

## Sources

[5] https://peraturan.go.id/files/peraturan-bps-no-6-tahun-2026.pdf
[6] https://peraturan.bpk.go.id/Download/422292/no-6-tahun-2026.pdf

[1] https://www.bps.go.id/id/publication/2025/12/24/a9b2f130776c7bea36008556/klasifikasi-baku-lapangan-usaha-indonesia-kbli-2025-.html
[2] https://webapi.bps.go.id/download.php?f=AQADHlCUdNTI7wAmmQlt97gYFIXV7StXwdE25cHDjYOOX7CD4aKTrijXXyN2cIDNlnFE8c-_8tSVqngp-qzG-jNLFvwzHg5Hgxfe0EocAoUELzSwWvyc0nO2omHV7nKKddse25PuXTWRKLvz0G3f5kJhqr-GLrNlME5SPVNtK__zeqU_UcsY3QNg7aBozkCtGv2BRa48QcQJT4LouC7Pb57sHMXoZX-FFrxZrwvIsB6pGgxsoj9ekrxAUr2Snw88W0MHw1fJxYBWIpKPhiWyuJ9z51hywMrkQE8t5gmTefiQ
[3] https://oss.go.id/id/kbli/detail/9f8bd843-df47-5b3d-8794-66a7d1be75b3
[4] https://jdih.bps.go.id/public/dokumen-hukum/eyJpdiI6InQrQTk2ZnJHTkxwMkhuSUcvTlVRWEE9PSIsInZhbHVlIjoidy9LWm1wb2pBRzkvK25MT3lpQlBFUT09IiwibWFjIjoiOTllNWZkYTU3NDE2NzY0ZTU5Y2MwMjJkMmI1OWFkMjBjMzcwNWYwYWUzMTRhNDlhNTk3ZDFiYTBmZDdmZDAwZSIsInRhZyI6IiJ9
