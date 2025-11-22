/**
 * Image handling: upload and serve
 */

import type { Env } from '../types';

export async function handleImageUpload(request: Request, env: Env): Promise<Response> {
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

export async function handleImageServe(request: Request, env: Env, filename: string): Promise<Response> {
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
