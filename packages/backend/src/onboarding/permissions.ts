import { createPermission } from '@backstage/plugin-permission-common';

// Gates both /organizations and /organizations/:org/repositories - see
// rbac/rbac-policy.csv (granted to developers and platform-admins).
export const idpOnboardingReadPermission = createPermission({
  name: 'idp.onboarding.read',
  attributes: { action: 'read' },
});
