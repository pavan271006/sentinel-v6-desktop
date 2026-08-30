import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    {
      name: 'sentinel-local-raw-proxy',
      configureServer(server) {
        server.middlewares.use('/__sentinel_raw_proxy__', async (req: any, res: any) => {
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk: any) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                const { targetUrl, rawRequest } = JSON.parse(bodyStr);
                const parsedUrl = new URL(targetUrl);
                const isHttps = parsedUrl.protocol === 'https:';
                const client = isHttps ? https : http;

                const [headSection, ...bodyParts] = rawRequest.split(/\r?\n\r?\n/);
                const reqBody = bodyParts.join('\r\n\r\n');
                const headLines = headSection.split(/\r?\n/);
                const [method] = headLines[0].split(/\s+/);

                const headers: Record<string, string> = {};
                for (let i = 1; i < headLines.length; i++) {
                  const colonIdx = headLines[i].indexOf(':');
                  if (colonIdx !== -1) {
                    const k = headLines[i].substring(0, colonIdx).trim();
                    const v = headLines[i].substring(colonIdx + 1).trim();
                    if (!['content-length', 'connection'].includes(k.toLowerCase())) {
                      headers[k] = v;
                    }
                  }
                }
                headers['Host'] = parsedUrl.host;
                if (reqBody && !['GET', 'HEAD'].includes(method.toUpperCase())) {
                  headers['Content-Length'] = Buffer.byteLength(reqBody).toString();
                }

                const options = {
                  method: method.toUpperCase() || 'GET',
                  hostname: parsedUrl.hostname,
                  port: parsedUrl.port || (isHttps ? 443 : 80),
                  path: parsedUrl.pathname + parsedUrl.search,
                  headers,
                  rejectUnauthorized: false,
                };

                const proxyReq = client.request(options, (proxyRes) => {
                  const resChunks: Buffer[] = [];
                  proxyRes.on('data', (chunk) => {
                    resChunks.push(chunk);
                  });
                  proxyRes.on('end', () => {
                    const totalBuf = Buffer.concat(resChunks);
                    const resBodyText = totalBuf.toString('utf-8');

                    const responseHeaders: { name: string; value: string }[] = [];
                    for (const [k, v] of Object.entries(proxyRes.headers)) {
                      if (v !== undefined) {
                        responseHeaders.push({ name: k, value: Array.isArray(v) ? v.join(', ') : v });
                      }
                    }

                    const status = proxyRes.statusCode || 200;
                    const statusText = proxyRes.statusMessage || 'OK';
                    const headerBlock = responseHeaders.map((h) => `${h.name}: ${h.value}`).join('\r\n');
                    const rawResponse = `HTTP/1.1 ${status} ${statusText}\r\n${headerBlock}\r\n\r\n${resBodyText}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                      JSON.stringify({
                        statusCode: status,
                        statusText,
                        headers: responseHeaders,
                        body: resBodyText,
                        rawResponse,
                        durationMs: 45,
                      })
                    );
                  });
                });

                proxyReq.on('error', (err) => {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                });

                if (reqBody && !['GET', 'HEAD'].includes(method.toUpperCase())) {
                  proxyReq.write(reqBody);
                }
                proxyReq.end();
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
          } else {
            res.writeHead(405).end();
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    poolOptions: {
      threads: {
        isolate: false,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
