import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/provider-risk',
        destination: '/partner-risk',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
