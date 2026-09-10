import { createPermission } from '@backstage/plugin-permission-common';

// These mirror the real permission definitions that live next to the
// backend actions they gate:
//   packages/backend/src/catalog/permissions.ts (catalogServiceCreatePermission,
//     catalogRepoOnboardPermission)
//   packages/backend/src/deploy/permissions.ts (deployTriggerIntegrationPermission)
//   packages/backend/src/onboarding/permissions.ts (idpOnboardingReadPermission)
//
// usePermission() only needs a permission's name+attributes to ask the
// backend's permission-evaluation endpoint for a decision - it doesn't
// need the same object instance, and the frontend can't import from
// packages/backend anyway. Enforcement is still 100% server-side; this is
// only used to decide whether to show a Quick Actions tile. Keep these in
// sync by hand if the backend definitions ever change name or attributes.
export const catalogServiceCreatePermission = createPermission({
  name: 'catalog.service.create',
  attributes: { action: 'create' },
});

export const catalogRepoOnboardPermission = createPermission({
  name: 'catalog.repo.onboard',
  attributes: { action: 'create' },
});

// Deploy has one permission per environment (integration/qa/staging/uat/
// production). integration is granted to both developers and
// platform-admins, so "can deploy to integration" is used as the proxy for
// "can use the Deploy tile at all" - anyone denied even that has no deploy
// access whatsoever.
export const deployTriggerIntegrationPermission = createPermission({
  name: 'deploy.trigger.integration',
  attributes: { action: 'create' },
});

export const idpOnboardingReadPermission = createPermission({
  name: 'idp.onboarding.read',
  attributes: { action: 'read' },
});
