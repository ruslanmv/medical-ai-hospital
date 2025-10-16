/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // << allows minimal runtime image (copy .next/standalone)
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
