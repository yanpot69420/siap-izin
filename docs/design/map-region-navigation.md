# Navigasi sorotan langsung dan lingkaran wilayah

Status: arahan Anton, 29 Oktober 2026; perubahan frontend, tanpa aktivasi dataset tambahan.

## Kebutuhan yang dikonfirmasi

- Klik Terapkan kriteria harus memperlihatkan sorotan di peta tanpa mengharuskan klik daftar RDTR.
- Pada tampilan luas, lingkaran kecil dapat dipakai untuk masuk ke wilayah; mendukung klik dan sentuh.
- Tetap ringan. Daftar sumber tetap tersedia untuk bukti, bukan langkah wajib untuk melihat sorotan.

## Implementasi terpilih dan batas

- Pertahankan persetujuan Muat peta publik sebelum mengambil Leaflet/tile. Setelah peta aktif, tindakan eksplisit Terapkan memusatkan kamera ke batas polygon sumber yang berhasil dimuat. Pembaruan viewport/response terlambat tidak boleh memusatkan kamera sendiri.
- Satu penanda navigasi per wilayah administratif yang memiliki inventaris valid dengan fitur dan bounds sumber. Gabungkan bounds rencana pada wilayah sama; hitung dari metadata inventaris, bukan menelusuri koordinat setiap fitur.
- Penanda hanyalah indeks navigasi, bukan batas kabupaten, lokasi proyek atau hasil penilaian izin. Klik/sentuh memperbesar area sumber yang tersedia pada wilayah tersebut.
- Lingkaran terlihat pada overview, berkurang/hilang saat focal agar tidak menutup polygon; tooltip dan label aksesibilitas eksplisit. Tidak memakai pin palsu untuk source gagal, not-in-release, unknown, atau kosong.
- Tetap satu instance Leaflet, tanpa minimap kedua, library baru atau animasi berulang. Tidak menambah endpoint, unduhan polygon baru atau geometri ekspor.
- Rilis saat ini tetap dua rencana; perubahan navigasi tidak mengaktifkan14rencana staging.

## Kriteria penerimaan

NAV-01: Setelah opt-in peta dan Terapkan, inventaris dan sorotan tersedia tanpa memilih baris; explicit apply boleh refit, pan/zoom/response viewport tidak boleh refit.
NAV-02: Lingkaran dikelompokkan per wilayah, bukan per polygon, dan jumlahnya dibatasi jumlah wilayah katalog.
NAV-03: Klik/sentuh/keyboard lingkaran memusatkan area sumber yang tepat; detail polygon tetap bekerja setelah zoom.
NAV-04: Lingkaran overview tidak menutup klik polygon pada focal dan tidak dihitung sebagai fitur zona.
NAV-05: Pergantian kriteria/abort membersihkan penanda lama; hasil gagal/unknown tidak menjadi lingkaran berhasil.
NAV-06: Regresi partial/error/409/pagination/source dates/pins/unknown permissions tetap lulus; browser native desktop dan mobile wajib diuji.
NAV-07: Ukur count marker, rebuild viewport-only dan request tambahan; tidak mengklaim percepatan produksi dari fixture.
