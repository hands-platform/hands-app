import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  distDir: process.env.ADMIN_NEXT_DIST_DIR || '.next',
  experimental: {
    serverActions: {
      // Partner public media is capped at 10 MB; the remainder covers multipart framing.
      bodySizeLimit: '11mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/provider-risk',
        destination: '/partner-controls',
        permanent: false,
      },
      {
        source: '/partner-risk',
        destination: '/partner-controls',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
