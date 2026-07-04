import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space-z.ai",
  ],
  // Build standalone: genera .next/standalone/ con server.js autocontenido
  // (sin necesidad de node_modules completos en producción).
  // El código fuente TS/TSX se compila a JS minificado — no se expone.
  output: "standalone",
};

export default nextConfig;
