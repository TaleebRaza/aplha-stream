import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Allows the CodeSandbox URL to access the server
    hmr: {
      overlay: false, // Optional: Disables the error overlay if it gets annoying during dev
    },
  },
});
