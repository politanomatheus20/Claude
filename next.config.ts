import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema interno com dados que mudam o tempo todo: renderização dinâmica
  // simples é mais previsível que Cache Components aqui.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Anexos até 4 MB (validados em src/lib/storage.ts). Na Vercel o teto da plataforma é 4,5 MB.
      bodySizeLimit: "5mb",
    },
  },
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
