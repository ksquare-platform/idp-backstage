import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createDispatchWorkflowAction } from './dispatchWorkflowAction';

export const deployDispatchWorkflowActionModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'deploy-dispatch-workflow-action',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        permissions: coreServices.permissions,
        catalog: catalogServiceRef,
      },
      async init({ scaffolder, config, permissions, catalog }) {
        scaffolder.addActions(
          createDispatchWorkflowAction(config, permissions, catalog),
        );
      },
    });
  },
});
