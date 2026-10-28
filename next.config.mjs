/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  basePath,
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "sharp",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
  },
};

export default nextConfig;
