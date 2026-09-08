/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import { kubeconfigClusterSupplierModule } from './kubernetes/kubeconfigClusterSupplierModule';
import { kubernetesDeployActionModule } from './kubernetes/deployActionModule';
import { githubRepoAccessActionsModule } from './github/repoAccessActionsModule';
import { catalogUserOnboardActionModule } from './catalog/onboardUserActionModule';
import { catalogRepoOnboardActionModule } from './catalog/onboardRepoActionModule';
import { deployDispatchWorkflowActionModule } from './deploy/dispatchWorkflowActionModule';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);
// Custom kubernetes:deploy action: see ./kubernetes/deployAction.ts
backend.add(kubernetesDeployActionModule);
// Custom github:repo:grant / github:repo:revoke actions:
// see ./github/repoAccessActions.ts
backend.add(githubRepoAccessActionsModule);
// Custom catalog:user:onboard action: see ./catalog/onboardUserAction.ts
backend.add(catalogUserOnboardActionModule);
// Custom catalog:repo:onboard action: see ./catalog/onboardRepoAction.ts
backend.add(catalogRepoOnboardActionModule);
// Custom github:workflow:dispatch action: see ./deploy/dispatchWorkflowAction.ts
backend.add(deployDispatchWorkflowActionModule);

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// See https://backstage.io/docs/auth/github/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// Community RBAC plugin: roles and per-resource policies are UI/CSV managed
// (see app-config.yaml's permission.rbac block and rbac/rbac-policy.csv),
// replacing the previous custom PermissionPolicy.
backend.add(import('@backstage-community/plugin-rbac-backend'));

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));
// Custom cluster supplier that reads a token-based kubeconfig file:
// see ./kubernetes/KubeconfigClustersSupplier.ts
backend.add(kubeconfigClusterSupplierModule);

// user settings plugin
backend.add(import('@backstage/plugin-user-settings-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions plugin
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.start();
