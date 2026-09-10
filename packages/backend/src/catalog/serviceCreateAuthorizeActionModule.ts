import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createServiceCreateAuthorizeAction } from './serviceCreateAuthorizeAction';

export const catalogServiceCreateAuthorizeActionModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'catalog-service-create-authorize-action',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        permissions: coreServices.permissions,
      },
      async init({ scaffolder, permissions }) {
        scaffolder.addActions(createServiceCreateAuthorizeAction(permissions));
      },
    });
  },
});
