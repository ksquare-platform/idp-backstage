# ${{ values.name }}

${{ values.description }}

## What this is

A minimal Node 22 + TypeScript + Fastify HTTP service, scaffolded from the
"Create a new service" template. It exposes a single `GET /healthz`
endpoint used for health checks.

## Running locally

```
npm install
npm run dev
```

The server listens on `http://localhost:8080` by default - override with
the `PORT` environment variable.

## Tests and type checking

```
npm run typecheck
npm test
```

CI runs `npm ci` when `package-lock.json` is committed, and falls back to
`npm install` otherwise - a fresh scaffold has no lockfile yet, so commit
one after your first local `npm install` to get faster, reproducible CI
installs.

## Deploying

CI currently only builds the Docker image, to catch a broken Dockerfile -
it isn't published anywhere yet, since there's no target registry or
runtime configured for this service. Publishing (and wiring up the
"Deploy a service" template's `ksquare.io/deploy-environments` annotation)
gets added once those are chosen.
