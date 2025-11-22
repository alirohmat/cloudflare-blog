/**
 * Public-facing handlers: homepage, post detail, search, sitemap
 */

import type { Env } from '../types';
import { renderLayout, escapeHtml, formatDate } from '../utils/render';

export async function handleHomepage(request: Request, env: Env): Promise<Response> {
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

export async function handlePostDetail(request: Request, env: Env, slug: string): Promise<Response> {
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

export async function handleSearch(request: Request, env: Env): Promise<Response> {
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

export async function handleSitemap(env: Env): Promise<Response> {
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
