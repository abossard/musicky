import "dotenv/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { parseFile } from "music-metadata";
import { vikeHandler } from "./server/vike-handler";
import { telefuncHandler } from "./server/telefunc-handler";
import Fastify from "fastify";
import { createHandler, createMiddleware } from "@universal-middleware/fastify";
import { dbMiddleware } from "./server/db-middleware";
import { createDevMiddleware } from "vike";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = __dirname;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const hmrPort = process.env.HMR_PORT ? parseInt(process.env.HMR_PORT, 10) : 24678;

async function startServer() {
  const app = Fastify();

  // Avoid pre-parsing body, otherwise it will cause issue with universal handlers
  // This will probably change in the future though, you can follow https://github.com/magne4000/universal-middleware for updates
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", function (_request, _payload, done) {
    done(null, "");
  });

  await app.register(await import("@fastify/middie"));

  if (process.env.NODE_ENV === "production") {
    await app.register(await import("@fastify/static"), {
      root: `${root}/dist/client`,
      wildcard: false,
    });
  } else {
    // Instantiate Vite's development server and integrate its middleware to our server.
    // ⚠️ We should instantiate it *only* in development. (It isn't needed in production
    // and would unnecessarily bloat our server in production.)
    const viteDevMiddleware = (
      await createDevMiddleware({
        root,
        viteConfig: {
          server: { hmr: { port: hmrPort } },
        },
      })
    ).devMiddleware;
    app.use(viteDevMiddleware);
  }

  await app.register(createMiddleware(dbMiddleware)());

  // Audio file serving route with HTTP Range support for seeking
  app.get<{ Params: { '*': string } }>('/audio/*', async (request, reply) => {
    try {
      // Extract file path from URL (remove /audio/ prefix)
      const filePath = request.params['*'];
      if (!filePath) {
        return reply.code(400).send({ error: 'File path required' });
      }

      // Get file stats
      const stats = await stat(filePath);
      const fileSize = stats.size;

      // Set content type
      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Accept-Ranges', 'bytes');

      // Handle range requests for seeking support
      const range = request.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        reply.code(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunkSize.toString());

        const stream = createReadStream(filePath, { start, end });
        return reply.send(stream);
      } else {
        // No range request, send entire file
        reply.header('Content-Length', fileSize.toString());
        const stream = createReadStream(filePath);
        return reply.send(stream);
      }
    } catch (error) {
      console.error('Error serving audio file:', error);
      return reply.code(404).send({ error: 'File not found' });
    }
  });

  // Artwork serving — extracts embedded album art from MP3 files
  app.get<{ Params: { '*': string } }>('/artwork/*', async (request, reply) => {
    const filePath = request.params['*'];
    if (!filePath) return reply.code(400).send({ error: 'File path required' });

    // Generate a colorful placeholder from the filename
    const makePlaceholder = (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
      const hue = Math.abs(hash) % 360;
      const initials = name.replace(/\.[^.]+$/, '').split(/[-_\s]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue},60%,25%)"/>
          <stop offset="100%" style="stop-color:hsl(${(hue + 60) % 360},50%,35%)"/>
        </linearGradient></defs>
        <rect width="120" height="120" fill="url(#g)"/>
        <text x="60" y="52" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="system-ui" font-size="28" font-weight="bold">${initials}</text>
        <text x="60" y="78" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="28">♪</text>
      </svg>`;
    };

    try {
      const metadata = await parseFile(filePath);
      const picture = metadata.common.picture?.[0];
      if (picture) {
        reply.header('Content-Type', picture.format);
        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(Buffer.from(picture.data));
      }
    } catch { /* fall through to placeholder */ }

    const filename = filePath.split('/').pop() || filePath;
    reply.header('Content-Type', 'image/svg+xml');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(makePlaceholder(filename));
  });

  app.post<{ Body: string }>("/_telefunc", createHandler(telefuncHandler)());

  /**
   * Vike route
   *
   * @link {@see https://vike.dev}
   **/
  app.all("/*", createHandler(vikeHandler)());

  return app;
}

const app = await startServer();

app.listen(
  {
    port: port,
  },
  () => {
    console.log(`Server listening on http://localhost:${port}`);
  },
);
