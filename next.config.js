/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

module.exports = nextConfig;
