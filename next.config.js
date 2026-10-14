/** @type {import('next').NextConfig} */
// Two build targets share one codebase:
//   PRICEPULSE_TARGET=web  -> static export for Firebase Hosting (frontend only)
//   (default)              -> Node server for Cloud Run (API + SSR)
const isWeb = process.env.PRICEPULSE_TARGET === 'web';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isWeb
    ? {
        // Frontend-only static export served by Firebase Hosting.
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // Backend/SSR server deployed to Cloud Run (run with `next start`).
        experimental: {
          // firebase-admin must stay an external Node dependency (not bundled).
          serverComponentsExternalPackages: ['firebase-admin'],
        },
      }),
};

module.exports = nextConfig;
