# Muhamad Fadli Firmansyah — Portfolio & Gallery

Portfolio pribadi berbasis HTML, CSS, dan JavaScript murni. Tidak perlu install package. Galeri lokal dapat dibuka langsung; fitur akun Supabase perlu dijalankan melalui Live Server atau web server lokal.

## Menjalankan

Buka `index.html` di browser, atau gunakan ekstensi Live Server di VS Code bila ingin reload otomatis saat mengedit.

## Deploy GitHub Pages

Repository ini dapat diterbitkan di `https://fadlifirmansyah1945-alt.github.io/porto/`. Workflow `.github/workflows/pages.yml` akan deploy otomatis setiap kali ada push ke branch `main`.

Untuk login Supabase di situs live, tambahkan `https://fadlifirmansyah1945-alt.github.io/porto/` sebagai Site URL dan `https://fadlifirmansyah1945-alt.github.io/porto/**` sebagai Redirect URL di Authentication → URL Configuration. `supabase-config.js` berisi URL proyek dan anon/public key yang memang dipakai frontend; jangan pernah memasukkan `service_role` key.

## Mengelola album dan karya

1. Tekan **Kelola** di navigasi untuk membuka dashboard.
2. Pilih **+ Album** atau **+ Karya**. Tombol tambah juga tersedia di bagian Album dan Portfolio.
3. Isi form lalu simpan. Album dan karya langsung tampil di galeri.
4. Dari dashboard, gunakan **Lihat**, **Edit**, dan **Hapus**. Penghapusan meminta konfirmasi.

Saat belum masuk, galeri contoh berjalan dengan data browser. Setelah masuk, album, karya, dan profil disimpan lokal lebih dulu lalu disinkronkan ke akun Supabase agar dapat dibuka lintas perangkat.

Pengunjung tanpa akun hanya dapat melihat isi portfolio dan direktori kreator. Tombol tambah, edit, hapus, favorit, follow, dan dashboard pengelolaan memerlukan sesi login. Supabase RLS membatasi perubahan portfolio dan profil pada pemiliknya; relasi follow hanya dapat dibuat atau dihapus oleh pengikut yang sedang masuk.

### Mengaktifkan akun dan sinkronisasi

1. Buat proyek Supabase.
2. Jalankan isi `supabase-schema.sql` di SQL Editor proyek. Tabel memakai Row Level Security agar pengguna hanya dapat membaca dan mengubah portfolio miliknya.
3. Salin Project URL dan anon/public key dari pengaturan API Supabase ke `url` dan `anonKey` di `supabase-config.js`. Jangan pernah memasukkan `service_role` key ke situs.
4. Jalankan atau jalankan ulang seluruh isi `social-schema.sql` di SQL Editor untuk mengaktifkan direktori kreator, halaman portfolio publik, daftar following/followers, dan notifikasi pengikut baru. Skrip aman dijalankan ulang. Profil dan karya portfolio memang terlihat publik; email serta data autentikasi tidak dibuka.
5. Di Authentication → URL Configuration, tambahkan URL lokal tempat situs dijalankan ke Site URL dan Redirect URLs. Server yang sedang disiapkan untuk proyek ini: `http://127.0.0.1:8000/**`. Contoh Live Server: `http://127.0.0.1:5500/**`.
6. Buka situs melalui URL web server lokal, lalu pilih **Akun** untuk membuka halaman masuk atau pendaftaran. Bila konfirmasi email aktif, konfirmasikan email sebelum masuk.

Akun baru mulai dengan album, karya, foto profil, bio, dan minat kosong. Data contoh maupun data browser tidak disalin ke akun baru. Setelah masuk, buka **Kelola → Edit profil** untuk mengatur nama, foto, bio, dan minat. Profil dengan nama akan muncul di bagian **Kreator**; pilih **Lihat portfolio** pada kartu untuk membuka profil lengkap, album, dan karya. Semua isi portfolio akun dapat dilihat publik; jangan unggah materi privat. Pengunjung tidak dapat mengubah data. Tombol **Ikuti** memerlukan login. Pemilik akun bisa membuka tab **Following** dan **Followers**, serta melihat pemberitahuan realtime saat ada pengikut baru pada tombol **Notifikasi**. Foto profil dikompres hingga 600 px. Perubahan disimpan lokal lebih dulu lalu disinkronkan ke akun; jika sinkronisasi gagal, data lokal tetap ada. Hindari menyimpan koleksi gambar yang sangat besar karena data gambar tersimpan bersama portfolio.

Gambar upload diubah menjadi JPEG berukuran paling panjang 1400 px sebelum disimpan. Hindari gambar berukuran besar; penyimpanan browser memiliki kuota terbatas.

## Bagian yang mudah diganti

- Profil akun: pilih **Kelola → Edit profil** setelah masuk. Kontak dan tautan sosial contoh tetap dapat diedit di `index.html`.
- Gambar hero dan foto profil: ganti alamat pada atribut `src` di `index.html`.
- Album/karya contoh: ubah `STARTER_DATA` di bagian atas `app.js`. Data starter hanya dipakai saat belum ada data tersimpan.
- Tampilan dan warna: edit variabel CSS di awal `style.css`.

Email `emailkamu@example.com` dan tautan sosial saat ini masih berupa contoh. Ganti dengan alamat dan akun milikmu sebelum membagikan situs. Foto profil di About juga masih contoh.

## Berkas proyek

- `index.html`: struktur halaman, form, dan dialog.
- `login.html` dan `login.js`: halaman masuk dan pendaftaran akun.
- `creator.html` dan `creator.js`: halaman publik profil serta karya kreator.
- `social-schema.sql`: tabel profil publik/follow dan kebijakan RLS untuk fitur komunitas.
- `style.css`: gaya visual dan layout responsif.
- `app.js`: data contoh, rendering galeri, pencarian, dan pengelolaan data.
- `.github/copilot-instructions.md`: catatan singkat untuk pekerjaan berikutnya di workspace ini.