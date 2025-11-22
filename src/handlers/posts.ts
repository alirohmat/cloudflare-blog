/**
 * Post management handlers: create, edit, update, delete
 */

import type { Env } from '../types';
import { renderLayout, escapeHtml } from '../utils/render';
import { POST_EDITOR_SCRIPT } from '../utils/scripts';

export async function handlePostEditor(request: Request, env: Env): Promise<Response> {
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
      ${POST_EDITOR_SCRIPT}
    </script>
    `
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

export async function handleSavePost(request: Request, env: Env): Promise<Response> {
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

export async function handlePostEditForm(request: Request, env: Env, slug: string): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response(null, { status: 302, headers: { Location: '/admin' } });
  }

  try {
    const post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first();

    if (!post) {
      return new Response('Post not found', { status: 404 });
    }

    const html = renderLayout(
      { title: 'Edit Artikel', description: 'Edit Artikel' },
      `
      <div class="max-w-4xl mx-auto px-4 py-12">
        <h1 class="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Edit Artikel</h1>
        <form action="/admin/update" method="POST" class="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md">
          <input type="hidden" name="original_slug" value="${escapeHtml(post.slug)}" />
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul</label>
            <input type="text" name="title" value="${escapeHtml(post.title)}" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (URL)</label>
            <input type="text" name="slug" value="${escapeHtml(post.slug)}" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excerpt (Ringkasan)</label>
            <textarea name="excerpt" rows="3" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none">${escapeHtml(post.excerpt || '')}</textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konten (HTML)</label>
            <textarea name="content" rows="10" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono">${escapeHtml(post.content)}</textarea>
          </div>
          
          <div class="flex items-center">
            <input type="checkbox" name="published" id="published" ${post.published ? 'checked' : ''} class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
            <label for="published" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Publish?</label>
          </div>
          
          <div class="flex justify-end gap-4">
            <a href="/admin/dashboard" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">Batal</a>
            <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold">Update Artikel</button>
          </div>
        </form>
      </div>
      `
    );
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

export async function handleUpdatePost(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const originalSlug = formData.get('original_slug') as string;
  const title = formData.get('title') as string;
  const slug = formData.get('slug') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const published = formData.get('published') ? 1 : 0;

  try {
    await env.DB.prepare(
      'UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, published = ?, updated_at = ? WHERE slug = ?'
    )
      .bind(title, slug, excerpt, content, published, new Date().toISOString(), originalSlug)
      .run();

    return new Response(null, { status: 302, headers: { Location: '/admin/dashboard' } });
  } catch (error) {
    return new Response(`Error updating post: ${error}`, { status: 500 });
  }
}

export async function handleDeletePost(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie');
  if (!cookie || !cookie.includes('auth=true')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const slug = formData.get('slug') as string;

  try {
    await env.DB.prepare('DELETE FROM posts WHERE slug = ?')
      .bind(slug)
      .run();

    return new Response(null, { status: 302, headers: { Location: '/admin/dashboard' } });
  } catch (error) {
    return new Response(`Error deleting post: ${error}`, { status: 500 });
  }
}
