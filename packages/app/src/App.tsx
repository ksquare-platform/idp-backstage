import { createApp } from '@backstage/frontend-defaults';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { githubAuthApiRef } from '@backstage/core-plugin-api';
import { SignInPage } from '@backstage/core-components';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import rbacPlugin from '@backstage-community/plugin-rbac';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { githubEntityPageModule } from './components/catalog/EntityPage';
import { githubActionsApiModule } from './apis';
import { themeModule } from './theme/ThemeModule';
import { deployEnvironmentPickerModule } from './scaffolder/DeployEnvironmentPickerModule';

const signInPageModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () =>
          props => (
            <SignInPage
              {...props}
              auto
              provider={{
                id: 'github',
                title: 'GitHub',
                message: 'Sign in using GitHub',
                apiRef: githubAuthApiRef,
              }}
            />
          ),
      },
    }),
  ],
});

export default createApp({
  features: [
    catalogPlugin,
    rbacPlugin,
    navModule,
    homeModule,
    signInPageModule,
    githubEntityPageModule,
    githubActionsApiModule,
    themeModule,
    deployEnvironmentPickerModule,
  ],
});
