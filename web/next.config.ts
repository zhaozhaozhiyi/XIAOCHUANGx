import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 桌面壳打包：Next standalone → apps/desktop/resources（PRD §5.3.7）
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
};

export default nextConfig;
