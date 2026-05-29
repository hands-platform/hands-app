import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
      {
        source: '/providers/:path*',
        destination: '/partners/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
