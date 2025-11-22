import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';

/**
 * Blog CMS Unit Tests
 * Tests for routing, image handling, and core functionality
 */

describe('Blog CMS Worker', () => {
	describe('Homepage', () => {
		it('should return homepage HTML', async () => {
			const request = new Request('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('text/html');
			const body = await response.text();
			expect(body).toContain('Artikel Terbaru');
		});
	});

	describe('Image Upload Endpoint', () => {
		it('should reject unauthorized requests', async () => {
			const formData = new FormData();
			formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

			const request = new Request('http://example.com/admin/upload', {
				method: 'POST',
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});

		it('should accept authorized image uploads', async () => {
			const formData = new FormData();
			const imageBlob = new Blob(['fake-image-data'], { type: 'image/png' });
			formData.append('image', imageBlob, 'test.png');

			const request = new Request('http://example.com/admin/upload', {
				method: 'POST',
				body: formData,
				headers: {
					Cookie: 'auth=true',
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toHaveProperty('success', true);
			expect(data).toHaveProperty('url');
			expect(data.url).toMatch(/^\/images\/.+\.png$/);
		});

		it('should reject invalid file types', async () => {
			const formData = new FormData();
			const invalidBlob = new Blob(['fake-pdf'], { type: 'application/pdf' });
			formData.append('image', invalidBlob, 'test.pdf');

			const request = new Request('http://example.com/admin/upload', {
				method: 'POST',
				body: formData,
				headers: {
					Cookie: 'auth=true',
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid file type');
		});

		it('should reject requests without files', async () => {
			const formData = new FormData();

			const request = new Request('http://example.com/admin/upload', {
				method: 'POST',
				body: formData,
				headers: {
					Cookie: 'auth=true',
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data).toHaveProperty('error', 'No file uploaded');
		});
	});

	describe('Image Serving Endpoint', () => {
		it('should return 404 for non-existent images', async () => {
			const request = new Request('http://example.com/images/non-existent.png');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});

		it('should serve existing images with correct headers', async () => {
			// First, upload an image
			const formData = new FormData();
			const imageBlob = new Blob(['test-image-data'], { type: 'image/png' });
			formData.append('image', imageBlob, 'test.png');

			const uploadRequest = new Request('http://example.com/admin/upload', {
				method: 'POST',
				body: formData,
				headers: { Cookie: 'auth=true' },
			});

			const uploadCtx = createExecutionContext();
			const uploadResponse = await worker.fetch(uploadRequest, env, uploadCtx);
			await waitOnExecutionContext(uploadCtx);
			const uploadData = await uploadResponse.json();

			// Now try to fetch the uploaded image
			const imageRequest = new Request(`http://example.com${uploadData.url}`);
			const imageCtx = createExecutionContext();
			const imageResponse = await worker.fetch(imageRequest, env, imageCtx);
			await waitOnExecutionContext(imageCtx);

			expect(imageResponse.status).toBe(200);
			expect(imageResponse.headers.get('Cache-Control')).toContain('public');
		});
	});

	describe('Admin Routes', () => {
		it('should redirect to admin login when not authenticated', async () => {
			const request = new Request('http://example.com/admin/dashboard');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/admin');
		});

		it('should allow access to admin login page', async () => {
			const request = new Request('http://example.com/admin');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const body = await response.text();
			expect(body).toContain('Admin Login');
		});

		it('should allow access to post editor when authenticated', async () => {
			const request = new Request('http://example.com/admin/new', {
				headers: { Cookie: 'auth=true' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const body = await response.text();
			expect(body).toContain('Buat Artikel Baru');
		});
	});

	describe('SEO Routes', () => {
		it('should serve robots.txt', async () => {
			const request = new Request('http://example.com/robots.txt');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('text/plain');
			const body = await response.text();
			expect(body).toContain('User-agent');
		});

		it('should serve sitemap.xml', async () => {
			const request = new Request('http://example.com/sitemap.xml');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('application/xml');
		});
	});

	describe('Route Priority', () => {
		it('should prioritize /images/ route over static assets', async () => {
			// This test ensures the routing order fix is maintained
			const request = new Request('http://example.com/images/test.png');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Should be handled by handleImageServe (404 if not exists)
			// NOT by static assets handler
			expect(response.status).toBe(404);
			const body = await response.text();
			expect(body).toContain('Image not found');
		});
	});

	describe('Post Management', () => {
		it('should reject unauthenticated post save requests', async () => {
			const formData = new FormData();
			formData.append('title', 'Test Post');
			formData.append('slug', 'test-post');
			formData.append('content', '<p>Test content</p>');

			const request = new Request('http://example.com/admin/save', {
				method: 'POST',
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	describe('Edit Post Feature', () => {
		it('should redirect to login when accessing edit page without auth', async () => {
			const request = new Request('http://example.com/admin/edit/test-post');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/admin');
		});

		it('should display edit form for authenticated users', async () => {
			const request = new Request('http://example.com/admin/edit/test-post', {
				headers: { Cookie: 'auth=true' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Will return 404 if post doesn't exist, 200 if it does
			expect([200, 404]).toContain(response.status);
		});

		it('should reject unauthorized update requests', async () => {
			const formData = new FormData();
			formData.append('original_slug', 'test-post');
			formData.append('title', 'Updated Title');
			formData.append('slug', 'test-post');
			formData.append('content', '<p>Updated content</p>');

			const request = new Request('http://example.com/admin/update', {
				method: 'POST',
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});

		it('should accept authorized update requests', async () => {
			const formData = new FormData();
			formData.append('original_slug', 'test-post');
			formData.append('title', 'Updated Title');
			formData.append('slug', 'test-post');
			formData.append('excerpt', 'Updated excerpt');
			formData.append('content', '<p>Updated content</p>');
			formData.append('published', 'on');

			const request = new Request('http://example.com/admin/update', {
				method: 'POST',
				body: formData,
				headers: { Cookie: 'auth=true' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/admin/dashboard');
		});
	});

	describe('Delete Post Feature', () => {
		it('should reject unauthorized delete requests', async () => {
			const formData = new FormData();
			formData.append('slug', 'test-post');

			const request = new Request('http://example.com/admin/delete', {
				method: 'POST',
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});

		it('should accept authorized delete requests', async () => {
			const formData = new FormData();
			formData.append('slug', 'test-post');

			const request = new Request('http://example.com/admin/delete', {
				method: 'POST',
				body: formData,
				headers: { Cookie: 'auth=true' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/admin/dashboard');
		});

		it('should only accept POST method for delete', async () => {
			const request = new Request('http://example.com/admin/delete', {
				method: 'GET',
				headers: { Cookie: 'auth=true' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Should not match the delete route (POST only)
			expect(response.status).not.toBe(302);
		});
	});

	describe('Admin Dashboard', () => {
		it('should show edit and delete buttons when authenticated', async () => {
			const request = new Request('http://example.com/admin/dashboard', {
				headers: { Cookie: 'auth=true' },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const body = await response.text();
			expect(body).toContain('Edit');
			expect(body).toContain('Hapus');
			expect(body).toContain('deletePost');
		});
	});
});
