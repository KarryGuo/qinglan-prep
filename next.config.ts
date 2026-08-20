import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 容器化部署：输出独立运行时（.next/standalone + server.js），镜像无需完整 node_modules
  output: "standalone",
  // libsql/adapter 含原生绑定与动态 require，禁止 webpack 打包，运行时从 node_modules 加载
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
};

export default nextConfig;
