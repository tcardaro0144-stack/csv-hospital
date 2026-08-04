import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // Serve the SPA from domain root (csvhospital.com/) — no nested base path.
  base: '/',
  plugins: [react(), tailwindcss(), basicSsl()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    https: true,
    // 0.0.0.0 so Pinggy / other tunnels can reach the process (not only loopback)
    host: '0.0.0.0',
    port: 5200,
    strictPort: true,
    // Vite allow-all (equivalent of webpack's allowedHosts: 'all')
    allowedHosts: true,
    // Browser hits the public HTTPS URL on :443 — HMR must use WSS through the tunnel
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
    // UI runs on https://localhost:5200 — proxy keeps /api on the same origin.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4242',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error(
              '[vite proxy] API unreachable at http://127.0.0.1:4242 — is npm run dev:server running?',
              err.message,
            )
          })
        },
      },
    },
  },
})
