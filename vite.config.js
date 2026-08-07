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
    // Local HTTPS on :5200 by default. Set VITE_HMR_CLIENT_PORT=443 when using a
    // public tunnel (Pinggy etc.) that terminates TLS on 443.
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? {
          clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) || 443,
          protocol: 'wss',
        }
      : {
          // Keep HMR on the same host/port as the page (https://localhost:5200)
          protocol: 'wss',
        },
    // UI runs on https://localhost:5200 — proxy keeps /api on the same origin.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4242',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.error(
              '[vite proxy] API unreachable at http://127.0.0.1:4242 — is npm run dev:server running?',
              err.message,
            )
            // Always JSON for /api — never plain text / HTML proxy errors.
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(502, {
                'Content-Type': 'application/json; charset=utf-8',
              })
              res.end(
                JSON.stringify({
                  error:
                    'API unreachable at http://127.0.0.1:4242. Start the backend with npm run dev:server (or npm run dev).',
                  code: 'api_unreachable',
                  sandbox: null,
                  isSandbox: false,
                }),
              )
            }
          })
        },
      },
    },
  },
})
