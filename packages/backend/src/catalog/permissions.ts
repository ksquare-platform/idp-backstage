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

// Same rationale again - gates the catalog:service:create scaffolder
// action (see rbac/rbac-policy.csv), which is a pure permission gate run
// as the first step of the "Create a new service" template, in front of
// the stock fetch:template/publish:github/catalog:register steps that
// actually do the work (there's no custom action among those to embed the
// check inside, unlike the two permissions above).
export const catalogServiceCreatePermission = createPermission({
  name: 'catalog.service.create',
  attributes: { action: 'create' },
});
