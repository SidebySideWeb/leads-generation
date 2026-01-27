/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Enable type checking in production
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
