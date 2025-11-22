/**
 * Admin authentication and dashboard handlers
 */

import type { Env } from '../types';
import { renderLayout, escapeHtml, formatDate } from '../utils/render';

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
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

export async function handleLogin(request: Request, env: Env): Promise<Response> {
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

export async function handleLogout(request: Request): Promise<Response> {
  const headers = new Headers();
  headers.append('Set-Cookie', `auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  headers.append('Location', '/admin');
  return new Response(null, { status: 302, headers });
}

export async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
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
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                  <a href="/posts/${post.slug}" target="_blank" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">Lihat</a>
                  <a href="/admin/edit/${post.slug}" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Edit</a>
                  <button onclick="deletePost('${escapeHtml(post.slug)}', '${escapeHtml(post.title)}')" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Hapus</button>
                </td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
    <script>
      function deletePost(slug, title) {
        if (confirm('Yakin ingin menghapus artikel "' + title + '"?')) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/admin/delete';
          
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'slug';
          input.value = slug;
          
          form.appendChild(input);
          document.body.appendChild(form);
          form.submit();
        }
      }
    </script>
    `
  );
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
