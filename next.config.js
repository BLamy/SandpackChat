/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Set the base path for GitHub Pages
  basePath: process.env.NODE_ENV === 'production' ? '/SandpackChat' : '',
  // Set the asset prefix for GitHub Pages
  assetPrefix: process.env.NODE_ENV === 'production' ? '/SandpackChat/' : '',
  // Enable static export
  trailingSlash: true,
};

module.exports = nextConfig; 