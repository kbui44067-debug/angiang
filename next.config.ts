import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // Ẩn hoàn toàn icon Next.js Dev ở góc màn hình
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.trycloudflare.com"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;