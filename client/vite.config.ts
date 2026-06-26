import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El frontend (puerto 5173) proxea /api al backend (puerto 4000)
// para evitar problemas de CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
