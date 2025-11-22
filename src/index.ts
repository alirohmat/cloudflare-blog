/**
 * Cloudflare Blog CMS - Main Entry Point
 * Database: D1 | Storage: R2
 */

import type { Env } from './types';
import { handleHomepage, handlePostDetail, handleSearch, handleSitemap } from './handlers/public';
import {
  handleAdminLogin,
  handleLogin,
  handleLogout,
  handleAdminDashboard,
} from './handlers/admin';
import {
  handlePostEditor,
  handleSavePost,
  handlePostEditForm,
  handleUpdatePost,
  handleDeletePost,
} from './handlers/posts';
import { handleImageUpload, handleImageServe } from './handlers/images';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Public routes
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

    if (path === '/sitemap.xml') {
      return handleSitemap(env);
    }

    if (path === '/robots.txt') {
      return new Response('User-agent: *\\nAllow: /', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Admin routes
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

    if (path.startsWith('/admin/edit/')) {
      const slug = path.replace('/admin/edit/', '');
      return handlePostEditForm(request, env, slug);
    }

    if (path === '/admin/update' && request.method === 'POST') {
      return handleUpdatePost(request, env);
    }

    if (path === '/admin/delete' && request.method === 'POST') {
      return handleDeletePost(request, env);
    }

    // Image routes
    if (path === '/admin/upload' && request.method === 'POST') {
      return handleImageUpload(request, env);
    }

    if (path.startsWith('/images/')) {
      const filename = path.replace('/images/', '');
      return handleImageServe(request, env, filename);
    }

    // Serve static files from public/
    if (path.startsWith('/')) {
      return env.ASSETS.fetch(request);
    }

    return new Response('404 Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
