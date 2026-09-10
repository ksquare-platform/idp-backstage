import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import StorageIcon from '@material-ui/icons/Storage';

const repositoriesPage = PageBlueprint.make({
  params: {
    path: '/repositories',
    title: 'Repositories',
    icon: <StorageIcon fontSize="inherit" />,
    loader: () => import('./RepositoriesPage').then(m => <m.RepositoriesPage />),
  },
});

// This must be a plugin, not a module: createFrontendModule() only extends
// an EXISTING plugin with a matching pluginId (see
// resolveAppNodeSpecs.esm.js in @backstage/frontend-app-api - a module
// whose pluginId matches no plugin has its extensions silently dropped, no
// warning). There's no frontend plugin named 'idp-onboarding' (that's the
// separate backend plugin id), so this needs its own plugin. The extension
// id is still 'page:idp-onboarding' either way - it's derived from just
// the pluginId (as namespace) and the blueprint's kind, not from
// Plugin-vs-Module - so Sidebar.tsx's nav.take('page:idp-onboarding')
// still matches.
export const repositoriesPlugin = createFrontendPlugin({
  pluginId: 'idp-onboarding',
  extensions: [repositoriesPage],
});
