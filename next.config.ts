import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "6mb" } }, // resume uploads up to 5 MB
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
