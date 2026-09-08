import { createPermission } from '@backstage/plugin-permission-common';

// No built-in Backstage permission is granular enough to gate a single
// custom scaffolder action (scaffolder.task.create isn't resource-typed,
// and this Backstage version registers no condition rules for the
// scaffolder-action resource type), so this action defines and checks its
// own permission directly - see rbac/rbac-policy.csv for who gets it.
export const catalogUserOnboardPermission = createPermission({
  name: 'catalog.user.onboard',
  attributes: { action: 'create' },
});

// Same rationale as catalogUserOnboardPermission above - gates the
// catalog:repo:onboard scaffolder action (see rbac/rbac-policy.csv).
export const catalogRepoOnboardPermission = createPermission({
  name: 'catalog.repo.onboard',
  attributes: { action: 'create' },
});
