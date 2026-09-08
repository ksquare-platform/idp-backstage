import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createCatalogRepoOnboardAction } from './onboardRepoAction';

export const catalogRepoOnboardActionModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'catalog-repo-onboard-action',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        permissions: coreServices.permissions,
      },
      async init({ scaffolder, config, permissions }) {
        scaffolder.addActions(
          createCatalogRepoOnboardAction(config, permissions),
        );
      },
    });
  },
});
