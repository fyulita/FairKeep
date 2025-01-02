import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    https: {
      key: '../key.pem',  // Path to your private key
      cert: '../cert.pem', // Path to your certificate
    },
    host: 'localhost',
    port: 5173, // Ensure it matches your development port
  },
  plugins: [react()],
});
