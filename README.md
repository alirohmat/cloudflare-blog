# Cloudflare CMS Blog

CMS Blog modern yang dibangun dengan **Remix**, **Cloudflare Pages**, **D1 Database**, dan **R2 Storage**. Proyek ini dirancang untuk performa tinggi, SEO-friendly, dan hemat biaya (serverless).

## 🚀 Fitur Utama

-   **Full Stack**: Menggunakan Remix (React Router) untuk frontend dan backend.
-   **Database**: SQLite terdistribusi menggunakan Cloudflare D1.
-   **Storage**: Penyimpanan gambar murah dan cepat dengan Cloudflare R2.
-   **Styling**: TailwindCSS dengan desain responsif (Mobile-First) dan Dark Mode.
-   **SEO**: Meta tags otomatis, Sitemap, dan Robots.txt.
-   **Admin Panel**: Dashboard untuk menulis dan mengelola artikel.
-   **Otomatisasi**: Hashtag di konten otomatis menjadi Kategori.

## 🛠️ Tech Stack

-   [Remix](https://remix.run/) (Framework)
-   [Cloudflare Pages](https://pages.cloudflare.com/) (Hosting)
-   [Cloudflare D1](https://developers.cloudflare.com/d1/) (Database)
-   [Cloudflare R2](https://developers.cloudflare.com/r2/) (Object Storage)
-   [TailwindCSS](https://tailwindcss.com/) (Styling)

## 📋 Prasyarat

-   Node.js v18 atau lebih baru
-   Akun Cloudflare (Gratis)
-   Akun GitHub

## ⚡ Panduan Instalasi Cepat

Untuk panduan langkah-demi-langkah yang sangat detail (termasuk setup D1 dan R2 di Dashboard), silakan baca **[WALKTHROUGH.md](./walkthrough.md)**.

### 1. Clone Repository

```bash
git clone https://github.com/username/cloudflare-blog-cms.git
cd cloudflare-blog-cms
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Cloudflare (Manual Dashboard)

Karena keterbatasan akses CLI, kita setup resource via Dashboard:

1.  Buat **D1 Database** bernama `blog_database`.
2.  Buat **R2 Bucket** bernama `blog-images`.
3.  Salin **Database ID** dan update `wrangler.jsonc`.

### 4. Setup Database Schema

Jalankan query SQL dari file `schema.sql` (atau lihat di `walkthrough.md`) di **D1 Console** pada Cloudflare Dashboard.

### 5. Jalankan Development Server

```bash
npm run dev
```

Akses aplikasi di `http://localhost:5173`.

### 6. Deployment

Push kode ke GitHub, dan hubungkan repository ke **Cloudflare Pages**.

-   **Build Command**: `npm run build`
-   **Output Directory**: `public`
-   **Bindings**: Tambahkan `DB` (D1) dan `R2_BUCKET` (R2) di pengaturan Pages.

## 📝 Lisensi

MIT
