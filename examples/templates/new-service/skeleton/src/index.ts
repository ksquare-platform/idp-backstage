import Fastify from 'fastify';

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: '${{ values.name }}',
  }));

  return app;
}

async function main() {
  const app = buildServer();
  const port = Number(process.env.PORT) || 8080;
  await app.listen({ host: '0.0.0.0', port });
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
