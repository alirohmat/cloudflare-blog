# Walkthrough: Membangun CMS Blog dengan Cloudflare Stack

Selamat datang! Panduan ini akan memandu Anda langkah demi langkah untuk membangun **CMS Blog** profesional menggunakan teknologi Cloudflare modern: **React Router** (Remix v2 successor), **Cloudflare Pages**, **D1** (SQLite), dan **R2** (Object Storage).

> [!IMPORTANT]
> **Untuk Siapa Panduan Ini?**
> Panduan ini dirancang untuk developer yang **tidak** memiliki akses `wrangler login` karena keterbatasan jaringan. Semua resource (D1, R2) akan dibuat melalui **Cloudflare Dashboard**, dan deployment dilakukan via **GitHub Pages Integration**.

## 📋 Daftar Isi

1. [Persiapan Awal](#1-persiapan-awal)
2. [Membuat Database D1](#2-membuat-database-d1)
3. [Membuat Bucket R2](#3-membuat-bucket-r2)
4. [Konfigurasi Proyek Lokal](#4-konfigurasi-proyek-lokal)
5. [Implementasi Backend Services](#5-implementasi-backend-services)
6. [Implementasi Frontend](#6-implementasi-frontend)
7. [Setup GitHub dan Deployment](#7-setup-github-dan-deployment)
8. [Testing dan Verifikasi](#8-testing-dan-verifikasi)

---

## 1. Persiapan Awal

### 1.1 Akun dan Tools yang Dibutuhkan

✅ **Akun Cloudflare** (gratis): [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)  
✅ **Akun GitHub** (gratis): [https://github.com/signup](https://github.com/signup)  
✅ **Node.js** versi 18+ terinstall  
✅ **Git** terinstall  
✅ **Text Editor** (VS Code, Cursor, dll.)

### 1.2 Struktur Proyek yang Sudah Dibuat

Proyek Anda sudah diinisialisasi di:
```
c:\Users\admin\Documents\cloudflare blog\cloudflare-blog\
```

Struktur folder:
```
cloudflare-blog/
├── src/
│   └── index.ts           # Entry point Worker
├── public/                # Static assets
├── wrangler.jsonc         # Cloudflare config
├── package.json
└── tsconfig.json
```

---

## 2. Membuat Database D1

### 2.1 Membuka Cloudflare Dashboard

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Di sidebar kiri, pilih **"Works & Pages"**
3. Klik tab **"D1 SQL Database"**

### 2.2 Membuat Database Baru

1. Klik tombol **"Create database"**
2. **Database name**: `blog_database` (gunakan nama ini persis!)
3. **Location**: Pilih **"Automatic"** (Cloudflare akan memilih lokasi optimal)
4. Klik **"Create"**

### 2.3 Menyimpan Database ID

Setelah database dibuat, Anda akan melihat halaman detail database. **SANGAT PENTING**:

1. Salin **Database ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
2. Simpan di notepad sementara, kita akan butuh ini nanti

**Contoh:**
```
Database ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 2.4 Membuat Schema Database

Kita akan membuat tabel-tabel yang dibutuhkan menggunakan **Console** di Dashboard.

1. Di halaman detail database, klik tab **"Console"**
2. Copy-paste SQL berikut **SATU PER SATU** dan klik **"Execute"** setelah tiap blok:

**Tabel 1: Users** (untuk admin login)
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Tabel 2: Posts** (untuk artikel blog)
```sql
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    cover_image_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   published BOOLEAN DEFAULT 0
);
```

**Tabel 3: Categories** (dibuat otomatis dari hashtags)
```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Tabel 4: Post_Categories** (relasi many-to-many)
```sql
CREATE TABLE IF NOT EXISTS post_categories (
    post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

**Tabel 5: Create Index untuk Performance**
```sql
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
```

### 2.5 Membuat Admin User (DEFAULT)

Kita akan membuat user admin default dengan password sederhana:

```sql
INSERT INTO users (username, password_hash) 
VALUES ('admin', 'admin123');
```

> [!WARNING]
> **Password ini HARUS diganti** setelah login pertama kali! Ini hanya untuk testing awal.

### 2.6 Verifikasi

Jalankan query ini untuk memastikan tabel berhasil dibuat:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

Anda harus melihat: `users`, `posts`, `categories`, `post_categories`

---

## 3. Membuat Bucket R2

### 3.1 Membuka R2 Dashboard

1. Masih di Cloudflare Dashboard
2. Di sidebar kiri, pilih **"R2 Object Storage"**
3. Jika pertama kali, klik **"Purchase R2"** (GRATIS untuk usage tier pertama!)

### 3.2 Membuat Bucket Baru

1. Klik **"Create bucket"**
2. **Bucket name**: `blog-images` (huruf kecil, tanpa spasi)
3. **Location**: Pilih **"Automatic"**
4. Klik **"Create bucket"**

---

## 4. Konfigurasi Proyek Lokal

Langkah-langkah detail konfigurasi wrangler, TailwindCSS, dan struktur file backend/frontend disediakan di dokumentasi proyek.

**File penting yang perlu dibuat:**
1. `wrangler.jsonc` - Binding D1 dan R2
2. `tailwind.config.js` - Konfigurasi Tailwind
3. `src/services/db.server.ts` - Helper D1
4. `src/services/storage.server.ts` - Helper R2
5. `src/services/auth.server.ts` - Auth logic
6. `src/index.ts` - Main Worker entry point

### 4.3 Update package.json Scripts & Dependencies

Kita perlu menambahkan library untuk security (bcrypt) dan styling.

```bash
npm install bcryptjs cookie
npm install -D @types/bcryptjs @types/cookie
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "build": "remix build",
    "dev": "remix dev --manual",
    "start": "wrangler pages dev ./public",
    "typecheck": "tsc"
  }
}
```

---

## 5. Implementasi Backend Services

Buat folder `app/services` (Remix menggunakan folder `app`, bukan `src` untuk logic utama).

### 5.1 Database Service (app/services/db.server.ts)

**File: `app/services/db.server.ts`**
```typescript
import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
}

// Helper untuk mengambil semua post published
export async function getPublishedPosts(db: D1Database) {
  const { results } = await db.prepare(
    'SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC'
  ).all();
  return results;
}

// Helper untuk mengambil post by slug
export async function getPostBySlug(db: D1Database, slug: string) {
  return await db.prepare(
    'SELECT * FROM posts WHERE slug = ?'
  ).bind(slug).first();
}

// Helper untuk search
export async function searchPosts(db: D1Database, query: string) {
  const term = `%${query}%`;
  const { results } = await db.prepare(
    'SELECT * FROM posts WHERE published = 1 AND (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC'
  ).bind(term, term).all();
  return results;
}
```

### 5.2 Auth Service (app/services/auth.server.ts)

**File: `app/services/auth.server.ts`**
```typescript
import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";
import bcrypt from "bcryptjs";

// Secret untuk session (Ganti dengan env var di production!)
const sessionSecret = "rahasia-super-aman"; 

const storage = createCookieSessionStorage({
  cookie: {
    name: "admin_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 hari
    httpOnly: true,
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function requireAdmin(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/admin/login");
  }
  return userId;
}

export async function login({ db, username, password }: any) {
  const user: any = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) return null;

  const isCorrect = await bcrypt.compare(password, user.password_hash);
  if (!isCorrect) return null;

  return user;
}
```

---

## 6. Implementasi Frontend (Remix Routes)

Remix menggunakan file-system routing di folder `app/routes`.

### 6.1 Root Layout (app/root.tsx)

Ini adalah layout utama aplikasi.

```tsx
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import styles from "./tailwind.css"; // Pastikan file ini ada

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
];

export default function App() {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
```

### 6.2 Homepage (app/routes/_index.tsx)

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getPublishedPosts } from "~/services/db.server";
import Layout from "~/components/Layout"; // Buat komponen Layout terpisah

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const { DB } = context.cloudflare.env;
  const posts = await getPublishedPosts(DB);
  return json({ posts });
};

export default function Index() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Artikel Terbaru</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
            <article key={post.id} className="border dark:border-gray-700 rounded-xl p-6 hover:shadow-lg transition">
              {post.cover_image_key && (
                <img src={`/images/${post.cover_image_key}`} alt={post.title} className="w-full h-48 object-cover rounded-lg mb-4" />
              )}
              <h2 className="text-2xl font-semibold mb-2">
                <Link to={`/posts/${post.slug}`} className="hover:text-blue-600">
                  {post.title}
                </Link>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{post.excerpt}</p>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
}
```

### 6.3 Post Detail (app/routes/posts.$slug.tsx)

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getPostBySlug } from "~/services/db.server";
import Layout from "~/components/Layout";

export const loader = async ({ params, context }: LoaderFunctionArgs) => {
  const { DB } = context.cloudflare.env;
  const post = await getPostBySlug(DB, params.slug as string);
  
  if (!post) {
    throw new Response("Not Found", { status: 404 });
  }
  
  return json({ post });
};

export const meta = ({ data }: any) => {
  return [
    { title: `${data.post.title} - Blog CMS` },
    { name: "description", content: data.post.excerpt },
  ];
};

export default function PostDetail() {
  const { post } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-5xl font-bold mb-4">{post.title}</h1>
        <div className="text-gray-500 mb-8">
          {new Date(post.created_at).toLocaleDateString("id-ID")}
        </div>
        <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </Layout>
  );
}
```

### 6.4 Admin Login (app/routes/admin.login.tsx)

```tsx
import { json, redirect, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { Form, useActionData } from "@remix-run/react";
import { login, createUserSession } from "~/services/auth.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const { DB } = context.cloudflare.env;

  const user = await login({ db: DB, username, password });

  if (!user) {
    return json({ error: "Invalid credentials" }, { status: 400 });
  }

  return createUserSession(user.id, "/admin/dashboard");
};

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
        <Form method="post" className="space-y-4">
          <div>
            <label className="block mb-1">Username</label>
            <input type="text" name="username" className="w-full border rounded p-2 dark:bg-gray-700" />
          </div>
          <div>
            <label className="block mb-1">Password</label>
            <input type="password" name="password" className="w-full border rounded p-2 dark:bg-gray-700" />
          </div>
          {actionData?.error && <p className="text-red-500">{actionData.error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Login
          </button>
        </Form>
      </div>
    </div>
  );
}
```
---

## 7. Setup GitHub dan Deployment

### 7.1 Inisialisasi Git Repository

```bash
cd "c:\Users\admin\Documents\cloudflare blog\cloudflare-blog"
git init
git add .
git commit -m "Initial commit: Cloudflare Blog CMS"
```

### 7.2 Create GitHub Repository

1. Buka [https://github.com/new](https://github.com/new)
2. **Repository name**: `cloudflare-blog-cms`
3. Klik **"Create repository"**

### 7.3 Push ke GitHub

```bash
git remote add origin https://github.com/USERNAME/cloudflare-blog-cms.git
git branch -M main
git push -u origin main
```

### 7.4 Connect ke Cloudflare Pages

1. Buka Cloudflare Dashboard → **"Workers & Pages"**
2. Klik **"Create"** → **"Pages"** → **"Connect to Git"**
3. Pilih repository: `cloudflare-blog-cms`
4. **Build command**: `npm run build:css`
5. **Build output**: `public`
6. **Bindings**:
   - D1: `DB` → `blog_database`
   - R2: `R2_BUCKET` → `blog-images`
7. Klik **"Save and Deploy"**

---

## 8. Testing dan Verifikasi

1. **Homepage**: Buka URL Pages Anda
2. **Admin**: Login di `/admin` dengan `admin/admin123`
3. **Dark Mode**: Toggle icon bulan/matahari
4. **Mobile**: Test responsive di DevTools

---

## 🎉 Selamat!

CMS Blog Anda sudah live di Cloudflare Edge! 

**Resources:**
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
