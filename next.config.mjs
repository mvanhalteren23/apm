/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'playroomkit',
    'gsap',
    'zustand',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Permissions-Policy',
          value: 'microphone=(self), camera=()',
        },
      ],
    },
  ],
};

export default nextConfig;
