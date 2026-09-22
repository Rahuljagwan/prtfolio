/** @type {import('next').NextConfig} */
// NEXT_DIST_DIR lets a production build run beside a live dev server without clobbering its .next cache.
const nextConfig = { distDir: process.env.NEXT_DIST_DIR || ".next" };

export default nextConfig;
