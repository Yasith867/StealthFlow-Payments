import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

export default defineConfig(async () => {
  const isDev =
    process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined;

  return {
    base: "/",

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

      // 🔥 IMPORTANT: fixes hidden build errors
      sourcemap: false,

      // 🔥 IMPORTANT: fixes Cofhe worker crash
      rollupOptions: {
        output: {
          format: "es",
          manualChunks: undefined, // avoids worker + code-split issues
        },
      },

      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },

    // 🔥 IMPORTANT: worker fix
    worker: {
      format: "es",
    },

    // 🔥 IMPORTANT: dependency fixes
    optimizeDeps: {
      exclude: ["@cofhe/sdk", "tfhe", "node-tfhe", "sonner"],
    },

    server: {
      port,
      host: "0.0.0.0",
    },

    preview: {
      port,
      host: "0.0.0.0",
    },
  };
});
