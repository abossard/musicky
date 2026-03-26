import { telefunc } from "telefunc/vite";
import react from "@vitejs/plugin-react";
import { compiled } from "vite-plugin-compiled-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";

export default defineConfig({
  plugins: [
    vike(),
    compiled({
      extract: true,
    }),
    react(),
    telefunc(),
  ],
  build: {
    target: "es2022",
  },
});
