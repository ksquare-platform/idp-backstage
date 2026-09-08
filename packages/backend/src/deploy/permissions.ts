import { createPermission, Permission } from '@backstage/plugin-permission-common';

export const ENVIRONMENTS = ['integration', 'qa', 'staging', 'uat', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// One permission per environment (rather than a single resource-typed
// "deploy.trigger" permission with a condition) since this Backstage
// version registers no condition rules for a custom resource type - see
// the same rationale in ../catalog/permissions.ts. rbac/rbac-policy.csv
// grants integration/qa/staging to developers and platform-admins, and uat/
// production to platform-admins only.
export const deployTriggerIntegrationPermission = createPermission({
  name: 'deploy.trigger.integration',
  attributes: { action: 'create' },
});

export const deployTriggerQaPermission = createPermission({
  name: 'deploy.trigger.qa',
  attributes: { action: 'create' },
});

export const deployTriggerStagingPermission = createPermission({
  name: 'deploy.trigger.staging',
  attributes: { action: 'create' },
});

export const deployTriggerUatPermission = createPermission({
  name: 'deploy.trigger.uat',
  attributes: { action: 'create' },
});

export const deployTriggerProductionPermission = createPermission({
  name: 'deploy.trigger.production',
  attributes: { action: 'create' },
});

export const deployTriggerPermissions = {
  integration: deployTriggerIntegrationPermission,
  qa: deployTriggerQaPermission,
  staging: deployTriggerStagingPermission,
  uat: deployTriggerUatPermission,
  production: deployTriggerProductionPermission,
} satisfies Record<Environment, Permission>;
