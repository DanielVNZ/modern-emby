import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",   // 👈 REQUIRED for Android / emulator access
    port: 5173,        // 👈 Match what Tauri is waiting for
    strictPort: true,  // 👈 Prevents silent port switching
  },
});
