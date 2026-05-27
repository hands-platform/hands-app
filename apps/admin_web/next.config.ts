import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/provider-risk',
        destination: '/partner-risk',
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
