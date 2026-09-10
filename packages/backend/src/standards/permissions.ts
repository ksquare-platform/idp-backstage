import { createPermission } from '@backstage/plugin-permission-common';

// Gates both /scorecards and /scorecards/:namespace/:kind/:name - read-only,
// so (unlike the onboarding/deploy/catalog permissions) this is granted to
// both developers and platform-admins in rbac/rbac-policy.csv.
export const idpStandardsReadPermission = createPermission({
  name: 'idp.standards.read',
  attributes: { action: 'read' },
});
