/**
 * Type definitions for Cloudflare Blog CMS
 */

export interface Env {
    DB: D1Database;
    R2_BUCKET: R2Bucket;
    ASSETS: Fetcher;
}
