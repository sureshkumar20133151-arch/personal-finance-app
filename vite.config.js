import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          "vendor-charts": ["recharts"],
          "vendor-ui": ["lucide-react", "clsx", "tailwind-merge"],
          "vendor-date": ["date-fns"],
          "vendor-parse": ["papaparse", "xlsx"],
        },
      },
    },
  },
});
