/** @type {import('next').NextConfig} */
const config = { distDir: process.env.NEXT_DIST_DIR || '.next', serverExternalPackages: ['quickjs-emscripten', 'typescript'] };
export default config;
