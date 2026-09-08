
## Environment constraints

- This project requires Node 22 (see .nvmrc). The Claude Code sandbox runs
  Node 20, which cannot compile this repo's native modules.
- NEVER run `yarn install`, `yarn add`, `npm install` or anything else that
  triggers a native rebuild. It breaks better-sqlite3 and takes the local
  dev backend down until it is rebuilt manually under Node 22.
- If a task needs a new dependency, STOP and tell me which package and
  version. I will install it myself.
