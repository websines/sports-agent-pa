/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  images: {
    domains: ['volleybox.net', 'i.ytimg.com'],
  },
};

module.exports = nextConfig;
