
## Environment constraints

- This project requires Node 22 (see .nvmrc). The Claude Code sandbox runs
  Node 20, which cannot compile this repo's native modules.
- NEVER run `yarn install`, `yarn add`, `npm install` or anything else that
  triggers a native rebuild. It breaks better-sqlite3 and takes the local
  dev backend down until it is rebuilt manually under Node 22.
- If a task needs a new dependency, STOP and tell me which package and
  version. I will install it myself.

## Frontend: adding a new page (new frontend system)

Use `createFrontendPlugin({ pluginId, extensions: [...] })`, NOT
`createFrontendModule`. A module extends an EXISTING frontend plugin; if its
pluginId matches no registered plugin, resolveAppNodeSpecs drops its
extensions silently — no error, no console warning, clean tsc, just a 404
route and no nav item. A backend plugin sharing the id does not count.

The extension id is `${kind}:${pluginId}` when no explicit name is set, e.g.
`page:idp-onboarding`.

Sidebar items are not automatic: packages/app/src/modules/nav/Sidebar.tsx
pulls specific items with `nav.take('page:<id>')`. A new page needs a line
added there.
