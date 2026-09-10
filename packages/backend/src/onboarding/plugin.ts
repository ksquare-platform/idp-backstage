import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

// Exposes GET /api/idp-onboarding/organizations and
// GET /api/idp-onboarding/organizations/:org/repositories - see ./router.ts.
export const idpOnboardingPlugin = createBackendPlugin({
  pluginId: 'idp-onboarding',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        permissions: coreServices.permissions,
        catalog: catalogServiceRef,
      },
      async init({ httpRouter, httpAuth, logger, config, permissions, catalog }) {
        // Default httpRouter policy already requires an authenticated
        // Backstage principal for every route on this plugin - no override
        // needed, since these endpoints must stay authenticated.
        httpRouter.use(
          await createRouter({ config, logger, permissions, catalog, httpAuth }),
        );
      },
    });
  },
});
