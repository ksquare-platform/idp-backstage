import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

// Exposes GET /api/idp-standards/scorecards and
// GET /api/idp-standards/scorecards/:namespace/:kind/:name - see ./router.ts.
export const idpStandardsPlugin = createBackendPlugin({
  pluginId: 'idp-standards',
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
        httpRouter.use(
          await createRouter({ config, logger, permissions, catalog, httpAuth }),
        );
      },
    });
  },
});
