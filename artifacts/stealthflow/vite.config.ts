import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async () => {
  const isDev =
    process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined;

  return {
    base: basePath,

    plugins: [
      wasm(),
      topLevelAwait(),
      react(),
      tailwindcss(),

      ...(isDev
        ? [
            (await import("@replit/vite-plugin-runtime-error-modal")).default(),
            (await import("@replit/vite-plugin-cartographer")).cartographer({
              root: path.resolve(__dirname, ".."),
            }),
            (await import("@replit/vite-plugin-dev-banner")).devBanner(),
          ]
        : []),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@assets": path.resolve(__dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },

    root: path.resolve(__dirname),

    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      target: "esnext",

      // 🔥 IMPORTANT FIX (cofhe worker issue)
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },

    // 🔥 IMPORTANT FIX (worker format issue)
    worker: {
      format: "es",
    },

    // 🔥 IMPORTANT FIX (dependency conflicts)
    optimizeDeps: {
      exclude: ["tfhe", "node-tfhe", "@cofhe/sdk"],
      include: ["@cofhe/sdk > viem", "@cofhe/sdk > zod"],
    },

    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },

    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
