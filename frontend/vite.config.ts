import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind-mounted source edited on a Windows host does not raise inotify
    // events inside a Linux container, so Vite's watcher never fires and HMR
    // silently does nothing -- the file is there, the container can read it,
    // and the browser keeps serving the module graph it built at startup.
    // Polling is the only thing that sees those writes. Off by default because
    // it costs CPU and native `npm run dev` does not need it; docker-compose
    // sets VITE_USE_POLLING for the containerised frontend.
    watch:
      process.env.VITE_USE_POLLING === "true"
        ? { usePolling: true, interval: 300 }
        : undefined,
  },
});
