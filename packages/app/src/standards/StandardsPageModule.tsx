import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import AssessmentIcon from '@material-ui/icons/Assessment';

const standardsPage = PageBlueprint.make({
  params: {
    path: '/standards',
    title: 'Standards',
    icon: <AssessmentIcon fontSize="inherit" />,
    loader: () => import('./StandardsPage').then(m => <m.StandardsPage />),
  },
});

// This must be a plugin, not a module - see repositoriesPlugin in
// packages/app/src/onboarding/RepositoriesPageModule.tsx and CLAUDE.md for
// why (a module needs an existing plugin with a matching pluginId; there's
// no frontend plugin named 'idp-standards'). The extension id is still
// 'page:idp-standards' - Sidebar.tsx's nav.take('page:idp-standards') must
// match this exactly.
export const standardsPlugin = createFrontendPlugin({
  pluginId: 'idp-standards',
  extensions: [standardsPage],
});
