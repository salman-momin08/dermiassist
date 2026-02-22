import { config } from 'dotenv';
config();

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // serverExternalPackages: ['stream-chat', 'stream-chat-react'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },

  webpack: (config, { isServer }) => {
    // Ignore dynamic require warnings from handlebars (used by Genkit)
    config.ignoreWarnings = [
      { module: /node_modules\/handlebars\/lib\/index\.js/ },
      { message: /require\.extensions is not supported by webpack/ },
    ];

    return config;
  },
};

export default nextConfig;
