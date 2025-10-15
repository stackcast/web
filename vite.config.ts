import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "idb-keyval": path.resolve(__dirname, "./node_modules/idb-keyval/dist/index.js"),
    },
  },
  optimizeDeps: {
    include: [
      "idb-keyval",
      "@walletconnect/keyvaluestorage",
      "@stacks/connect",
      "@stacks/transactions",
      "@stacks/network",
      "@stacks/encryption",
    ],
  },
  build: {
    commonjsOptions: {
      include: [/idb-keyval/, /node_modules/],
    },
  },
});
