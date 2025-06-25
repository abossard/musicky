import "dotenv/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
