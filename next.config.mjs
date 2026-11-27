/** @type {import('next').NextConfig} */
// BASE_PATH se usa al publicar en GitHub Pages (https://usuario.github.io/tamboalerta).
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
