import { defineConfig } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'portable-playtest-review',
    configureServer(server) {
      // This large, self-contained receipt already embeds every image. Stream it
      // directly so Vite does not parse it or inject the development client.
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/playtest-out/review/voxel-heroes-review.html') return next();
        const path = resolve(server.config.root, 'playtest-out/review/voxel-heroes-review.html');
        if (!existsSync(path) || !['GET', 'HEAD'].includes(req.method)) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Length', statSync(path).size);
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') return res.end();
        const stream = createReadStream(path);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      });
    },
  }],
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 1000,
  },
});
