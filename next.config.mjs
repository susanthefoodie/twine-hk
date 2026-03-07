/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  images: {
    remotePatterns: [
      // Google profile photos (avatars)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Our own origin — used by the /api/places/photo proxy
      // (Next/Image <Image src="/api/places/photo?..."> doesn't need a remotePattern
      //  since it's a relative URL, but listing it avoids issues in production)
    ],
  },
};

export default nextConfig;
