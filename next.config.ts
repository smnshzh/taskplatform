import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.24'],
  output: "standalone",
  reactStrictMode: false,
};

export default nextConfig;
