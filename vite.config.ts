import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";

/**
 * The dev server proxies `/api` to the Express server so the browser only ever
 * talks to its own origin:
 *   • no CORS preflights on every request
 *   • no `localhost:5000` baked into the client (which would break the
 *     sandboxed preview, a phone on the LAN, or a deployed build)
 *   • EventSource (SSE) works through the proxy with `changeOrigin`
 *
 * Override the target with VITE_PROXY_TARGET when the API runs elsewhere.
 */
const API_TARGET = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5000";

export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": "/src",
        },
    },
    server: {
        host: "0.0.0.0",
        port: 8080,
        strictPort: true,
        // Preview hosts (e.g. *.e2b.app) and LAN IPs must be allowed.
        allowedHosts: true,
        proxy: {
            "/api": {
                target: API_TARGET,
                changeOrigin: true,
                ws: false,
                // SSE: never buffer or time out a live stream.
                configure: (proxy) => {
                    proxy.on("proxyReq", (proxyReq) => {
                        proxyReq.setHeader("X-Forwarded-Host", "localhost");
                    });
                    proxy.on("proxyRes", (proxyRes) => {
                        if (String(proxyRes.headers["content-type"] || "").includes("text/event-stream")) {
                            proxyRes.headers["cache-control"] = "no-cache, no-transform";
                        }
                    });
                },
            },
        },
    },
    preview: {
        host: "0.0.0.0",
        port: 8080,
    },
    build: {
        target: "es2020",
        cssCodeSplit: true,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            output: {
                // Long-term cacheable vendor chunks: a dashboard deploy only
                // invalidates the app chunk, not React or recharts.
                manualChunks: {
                    react: ["react", "react-dom", "react-router-dom"],
                    charts: ["recharts"],
                    icons: ["lucide-react"],
                    http: ["axios"],
                },
            },
        },
    },
    esbuild: {
        legalComments: "none",
    },
}));
