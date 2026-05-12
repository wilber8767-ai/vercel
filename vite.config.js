import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,          // expose to network (for mobile testing on same Wi-Fi)
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
