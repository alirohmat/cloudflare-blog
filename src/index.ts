/**
 * Cloudflare Blog CMS - Simple Worker Version
 * Database: D1 | Storage: R2
 */

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Routing
    if (path === '/') {
      return handleHomepage(request, env);
    }

    if (path.startsWith('/posts/')) {
      const slug = path.replace('/posts/', '');
      return handlePostDetail(request, env, slug);
    }

    if (path === '/search') {
      return handleSearch(request, env);
    }

    if (path === '/admin') {
      return handleAdminLogin(request, env);
    }

    if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (path === '/logout' && request.method === 'POST') {
      return handleLogout(request);
    }

    if (path === '/admin/dashboard') {
      return handleAdminDashboard(request, env);
    }

    if (path === '/admin/new') {
      return handlePostEditor(request, env);
    }

    if (path === '/admin/save' && request.method === 'POST') {
      return handleSavePost(request, env);
    }

    if (path === '/admin/upload' && request.method === 'POST') {
      return handleImageUpload(request, env);
    }

    if (path.startsWith('/images/')) {
      const filename = path.replace('/images/', '');
      return handleImageServe(request, env, filename);
    }

    if (path === '/sitemap.xml') {
      return handleSitemap(env);
    }

    if (path === '/robots.txt') {
      return new Response('User-agent: *\\nAllow: /', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Serve static files from public/
    if (path.startsWith('/')) {
      return env.ASSETS.fetch(request);
    }

    return new Response('404 Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ========== HANDLERS ==========

async function handleHomepage(request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC LIMIT 10'
    ).all();

    const posts = results || [];

    const html = renderLayout(
      {
        title: 'Beranda - Blog CMS',
        description: 'Blog profesional dengan Cloudflare Stack',
      },
      `
      <div class="max-w-6xl mx-auto px-4 py-12">
        <h1 class="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Artikel Terbaru</h1>
        ${posts.length === 0
        ? `
          <div class="text-center py-12">
            <p class="text-gray-600 dark:text-gray-400 text-lg">Belum ada artikel. Silakan buat artikel pertama Anda di <a href="/admin" class="text-blue-600 hover:underline">Admin Panel</a>.</p>
          </div>
        `
        : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${posts
          .map(
            (post: any) => `
              <article class="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                ${post.cover_image_key
                ? `<img src="/images/${post.cover_image_key}" alt="${escapeHtml(post.title)}" class="w-full h-48 object-cover" />`
                : ''
              }
                <div class="p-6">
                  <h2 class="text-2xl font-semibold mb-2">
                    <a href="/posts/${post.slug}" class="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      ${escapeHtml(post.title)}
                    </a>
                  </h2>
                  <p class="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">${escapeHtml(post.excerpt || '')}</p>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500 dark:text-gray-500">${formatDate(post.created_at)}</span>
                    <a href="/posts/${post.slug}" class="text-blue-600 hover:underline">Baca →</a>
                  </div>
                </div>
              </article>
            `
          )
          .join('')}
          </div>
        `
      }
      </div>
      `
    );

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  } catch (error) {
    return new Response(
      `Error: ${error instanceof Error ? error.message : 'Database tidak terhubung'}`,
      { status: 500 }
    );
  }
}

async function handlePostDetail(request: Request, env: Env, slug: string): Promise<Response> {
  try {
    const post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1 LIMIT 1')
      .bind(slug)
      .first();

    if (!post) {
      return new Response('404 - Post Not Found', { status: 404 });
    }

    const html = renderLayout(
      {
        title: `${post.title} - Blog CMS`,
        description: post.excerpt || '',
      },
      `
      <article class="max-w-4xl mx-auto px-4 py-12">
        ${post.cover_image_key
        ? `<img src="/images/${post.cover_image_key}" alt="${escapeHtml(post.title)}" class="w-full h-96 object-cover rounded-2xl mb-8" />`
        : ''
      }
        <h1 class="text-5xl font-bold mb-4 text-gray-900 dark:text-white">${escapeHtml(post.title)}</h1>
        <div class="text-gray-500 dark:text-gray-400 mb-8">
          📅 ${formatDate(post.created_at)}
        </div>
        <div class="prose prose-lg dark:prose-invert max-w-none">
          ${post.content}
        </div>
        <div class="mt-12 pt-8 border-t dark:border-gray-700">
          <a href="/" class="text-blue-600 hover:underline">← Kembali ke Beranda</a>
        </div>
      </article>
      `
    );

    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  } catch (error) {
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      status: 500,
    });
  }
}

async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';

  let results: any[] = [];

  if (query) {
    const searchTerm = `%${query}%`;
    const { results: dbResults } = await env.DB.prepare(
      'SELECT * FROM posts WHERE published = 1 AND (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC LIMIT 20'
    )
      .bind(searchTerm, searchTerm)
      .all();
    results = dbResults || [];
  }

  const html = renderLayout(
    {
      title: `Pencarian: ${query} - Blog CMS`,
      description: '',
    },
    `
    <div class="max-w-4xl mx-auto px-4 py-12">
      <h1 class="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Hasil Pencarian: "${escapeHtml(query)}"</h1>
      ${results.length === 0
      ? `<p class="text-gray-600 dark:text-gray-400">Tidak ada hasil ditemukan.</p>`
      : `
        <div class="space-y-6">
          ${results
        .map(
          (post: any) => `
            <article class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              <h2 class="text-2xl font-semibold mb-2">
                <a href="/posts/${post.slug}" class="text-gray-900 dark:text-white hover:text-blue-600">
                  ${escapeHtml(post.title)}
                </a>
              </h2>
              <p class="text-gray-600 dark:text-gray-400">${escapeHtml(post.excerpt || '')}</p>
            </article>
          `
        )
        .join('')}
        </div>
      `
    }
    </div>
    `
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

// ========== ADMIN HANDLERS ==========

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  const html = renderLayout(
    { title: 'Admin Login', description: 'Login ke Admin Panel' },
    `
    <div class="max-w-md mx-auto px-4 py-12">
      <div class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
        <h1 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">Admin Login</h1>
        <form action="/login" method="POST" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input type="text" name="username" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input type="password" name="password" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold">Login</button>
        </form>
      </div>
    </div>
    `
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  // Simple Hardcoded Auth (Ganti password ini nanti!)
  if (username === 'admin' && password === 'admin123') {
    const headers = new Headers();
    headers.append('Set-Cookie', `auth=true; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
    headers.append('Location', '/admin/dashboard');
    return new Response(null, { status: 302, headers });
  }

  return new Response('Login Failed', { status: 401 });
}

async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response(null, { status: 302, headers: { Location: '/admin' } });
  }

  const { results } = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  const posts = results || [];

  const html = renderLayout(
    { title: 'Dashboard', description: 'Admin Dashboard' },
    `
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div class="flex gap-4">
          <a href="/admin/new" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">Buat Artikel Baru</a>
          <form action="/logout" method="POST" class="inline">
            <button type="submit" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">Logout</button>
          </form>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <table class="w-full text-left">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Judul</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tanggal</th>
              <th class="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            ${posts
      .map(
        (post: any) => `
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">${escapeHtml(post.title)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${post.published
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }">
                    ${post.published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">${formatDate(post.created_at)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <a href="/posts/${post.slug}" target="_blank" class="text-blue-600 hover:text-blue-900 mr-4">Lihat</a>
                  <a href="#" class="text-red-600 hover:text-red-900">Hapus (Segera)</a>
                </td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
    `
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handlePostEditor(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response(null, { status: 302, headers: { Location: '/admin' } });
  }

  const html = renderLayout(
    { title: 'Buat Artikel Baru', description: 'Editor Artikel' },
    `
    <div class="max-w-4xl mx-auto px-4 py-12">
      <h1 class="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Buat Artikel Baru</h1>
      <form id="postForm" action="/admin/save" method="POST" class="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul</label>
          <input type="text" id="titleInput" name="title" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (URL)</label>
          <input type="text" id="slugInput" name="slug" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
          <p class="text-xs text-gray-500 mt-1">Otomatis di-generate dari judul. Anda bisa mengubahnya jika perlu.</p>
        </div>
        
        <!-- Cover Image Upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Image</label>
          <div class="flex gap-2">
            <input type="file" id="coverImageInput" accept="image/*" class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="button" id="uploadCoverBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition whitespace-nowrap">Upload Cover</button>
          </div>
          <input type="hidden" id="coverImageKey" name="cover_image_key" />
          <div id="coverPreview" class="mt-3 hidden">
            <img id="coverPreviewImg" src="" alt="Cover preview" class="w-full max-w-md h-48 object-cover rounded-lg" />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excerpt (Ringkasan)</label>
          <textarea name="excerpt" rows="3" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
        </div>
        
        <!-- Content with Image Upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konten (HTML)</label>
          <div class="mb-2">
            <input type="file" id="contentImageInput" accept="image/*" class="inline-block mr-2 text-sm" />
            <button type="button" id="uploadContentImageBtn" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition">📷 Upload & Sisipkan Gambar</button>
          </div>
          <textarea id="contentArea" name="content" rows="10" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono"></textarea>
          <p class="text-xs text-gray-500 mt-1">Gunakan tag HTML seperti &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;.</p>
        </div>
        
        <div class="flex items-center">
          <input type="checkbox" name="published" id="published" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
          <label for="published" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Publish sekarang?</label>
        </div>
        
        <div id="uploadStatus" class="hidden p-3 rounded-lg"></div>
        
        <div class="flex justify-end gap-4">
          <a href="/admin/dashboard" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">Batal</a>
          <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold">Simpan Artikel</button>
        </div>
      </form>
    </div>
    
    <script>
      // Auto-generate slug from title
      const titleInput = document.getElementById('titleInput');
      const slugInput = document.getElementById('slugInput');
      
      titleInput.addEventListener('input', (e) => {
        const title = e.target.value;
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9\\s-]/g, '') // Remove special characters
          .trim()
          .replace(/\\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-'); // Remove consecutive hyphens
        slugInput.value = slug;
      });
      
      // Upload cover image
      const uploadCoverBtn = document.getElementById('uploadCoverBtn');
      const coverImageInput = document.getElementById('coverImageInput');
      const coverImageKey = document.getElementById('coverImageKey');
      const coverPreview = document.getElementById('coverPreview');
      const coverPreviewImg = document.getElementById('coverPreviewImg');
      
      uploadCoverBtn.addEventListener('click', async () => {
        const file = coverImageInput.files[0];
        if (!file) {
          showStatus('Pilih gambar terlebih dahulu', 'error');
          return;
        }
        
        await uploadImage(file, (result) => {
          coverImageKey.value = result.filename;
          coverPreviewImg.src = result.url;
          coverPreview.classList.remove('hidden');
          showStatus('Cover image berhasil diupload!', 'success');
        });
      });
      
      // Upload and insert content image
      const uploadContentImageBtn = document.getElementById('uploadContentImageBtn');
      const contentImageInput = document.getElementById('contentImageInput');
      const contentArea = document.getElementById('contentArea');
      
      uploadContentImageBtn.addEventListener('click', async () => {
        const file = contentImageInput.files[0];
        if (!file) {
          showStatus('Pilih gambar terlebih dahulu', 'error');
          return;
        }
        
        await uploadImage(file, (result) => {
          const imgTag = \`<img src="\${result.url}" alt="Image" class="w-full max-w-2xl rounded-lg my-4" />\`;
          contentArea.value += '\\n' + imgTag + '\\n';
          contentImageInput.value = ''; // Clear file input
          showStatus('Gambar berhasil disisipkan ke konten!', 'success');
        });
      });
      
      // Upload image helper function
      async function uploadImage(file, onSuccess) {
        const formData = new FormData();
        formData.append('image', file);
        
        showStatus('Uploading...', 'info');
        
        try {
          const response = await fetch('/admin/upload', {
            method: 'POST',
            body: formData
          });
          
          const result = await response.json();
          
          if (result.success) {
            onSuccess(result);
          } else {
            showStatus('Error: ' + (result.error || 'Upload gagal'), 'error');
          }
        } catch (error) {
          showStatus('Error: ' + error.message, 'error');
        }
      }
      
      // Show status message
      function showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.textContent = message;
        statusDiv.className = 'p-3 rounded-lg';
        
        if (type === 'success') {
          statusDiv.className += ' bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        } else if (type === 'error') {
          statusDiv.className += ' bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        } else {
          statusDiv.className += ' bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
        
        statusDiv.classList.remove('hidden');
        
        if (type !== 'info') {
          setTimeout(() => {
            statusDiv.classList.add('hidden');
          }, 3000);
        }
      }
    </script>
    `
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleSavePost(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const title = formData.get('title') as string;
  const slug = formData.get('slug') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const published = formData.get('published') ? 1 : 0;
  const coverImage = formData.get('cover_image_key') as string | null;

  try {
    await env.DB.prepare(
      'INSERT INTO posts (slug, title, content, excerpt, published, cover_image_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(slug, title, content, excerpt, published, coverImage || null, new Date().toISOString(), new Date().toISOString())
      .run();

    return new Response(null, { status: 302, headers: { Location: '/admin/dashboard' } });
  } catch (error) {
    return new Response(`Error saving post: ${error}`, { status: 500 });
  }
}

async function handleImageUpload(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

    // Upload to R2
    await env.R2_BUCKET.put(filename, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Return the URL
    return new Response(JSON.stringify({
      success: true,
      url: `/images/${filename}`,
      filename: filename
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Upload failed: ${error}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleImageServe(request: Request, env: Env, filename: string): Promise<Response> {
  try {
    const object = await env.R2_BUCKET.get(filename);

    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    return new Response(object.body, { headers });
  } catch (error) {
    return new Response('Error serving image', { status: 500 });
  }
}

async function handleLogout(request: Request): Promise<Response> {
  const headers = new Headers();
  headers.append('Set-Cookie', `auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  headers.append('Location', '/admin');
  return new Response(null, { status: 302, headers });
}

async function handleSitemap(env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare('SELECT slug, updated_at FROM posts WHERE published = 1').all();

    const posts = results || [];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${posts
        .map(
          (post: any) => `
  <url>
    <loc>https://yourdomain.com/posts/${post.slug}</loc>
    <lastmod>${post.updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
        )
        .join('')}
</urlset>`;

    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    return new Response('Error generating sitemap', { status: 500 });
  }
}

// ========== LAYOUT & UTILITIES ==========

function renderLayout(meta: { title: string; description: string }, content: string): string {
  return `<!DOCTYPE html>
<html lang="id" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  
  <!-- SEO Meta Tags -->
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  
  <style>
    body { font-family: 'Inter', sans-serif; }
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  </style>
  
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: {"50":"#eff6ff","100":"#dbeafe","200":"#bfdbfe","300":"#93c5fd","400":"#60a5fa","500":"#3b82f6","600":"#2563eb","700":"#1d4ed8","800":"#1e40af","900":"#1e3a8a","950":"#172554"}
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
  <!-- Navbar -->
  <nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-sm bg-opacity-90">
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div class="flex justify-between items-center">
        <a href="/" class="text-2xl font-bold text-blue-600">Blog CMS</a>
        
        <div class="flex items-center gap-6">
          <a href="/" class="hover:text-blue-600 transition">Beranda</a>
          
          <!-- Search Form -->
          <form action="/search" method="GET" class="relative">
            <input 
              type="text" 
              name="q" 
              placeholder="Cari artikel..." 
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </form>
          
          <a href="/admin" class="hover:text-blue-600 transition">Admin</a>
          
          <!-- Dark Mode Toggle -->
          <button onclick="toggleDarkMode()" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <span class="dark:hidden">🌙</span>
            <span class="hidden dark:inline">☀️</span>
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="min-h-screen">
    ${content}
  </main>

  <!-- Footer -->
  <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-12">
    <div class="max-w-6xl mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
      <p>&copy; ${new Date().getFullYear()} Blog CMS. Powered by Cloudflare.</p>
    </div>
  </footer>

  <script>
    function toggleDarkMode() {
      const html = document.documentElement;
      html.classList.toggle('dark');
      localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    }
    
    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
